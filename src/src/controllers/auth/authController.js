const { queryDatabase } = require("../../config/db");
const queries = require("../../config/queries");
const otpGenerator = require('otp-generator');
const { ERROR_MESSAGES, SUCCESS_MESSAGES } = require("../../utils/errors");
const { OTP_EXPIRE_MINUTES, BCRYPT_SALT_ROUNDS } = require("../../config/constants");
const bcrypt = require('bcrypt');
const { sendOtpEmail, sendForgotPasswordOtpEmail } = require("../../utils/email");
const jwt = require('jsonwebtoken');
const { TABLES } = require("../../config/tables");
const { errorMonitor } = require("nodemailer/lib/xoauth2");
const account_created_timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
const axios = require('axios');

// Validate password complexity
function validatePassword(password) {
  if (!password || password.length < 8) return 'Password should be minimum 8 characters. And it should contain at least one uppercase, lowercase letter, one number and one special character';
  if (!/[A-Z]/.test(password)) return 'Password should contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password should contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password should contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password should contain at least one special character.';
  return null;
}

// Sending Email OTP
const sendEmailOTP = async (req, res) => {
  try {
    const { email, username } = req.body;

    if (!email || !username) {
      return res.status(400).json({
        status: 'error',
        error: 'MISSING_FIELDS',
        message: ERROR_MESSAGES.MISSING_FIELDS,
      });
    }

    // Check if email exists in users
    const [rows] = await queryDatabase(queries.getUserByEmail, [email]);
    if (rows && rows.length > 0) {
      return res.status(400).json({
        status: 'error',
        error: 'EMAIL_ALREADY_EXISTS',
        message: ERROR_MESSAGES.EMAIL_ALREADY_EXISTS
      });
    }

    // invalidate previous OTPs
    await queryDatabase(
      `UPDATE ${TABLES.EMAIL_OTP_REGISTER} SET status = 1 WHERE email = ? AND status = 0`,
      [email]
    );

    // Generate OTP
    const otp = otpGenerator.generate(4, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false
    });
    const createdAt = new Date();
    const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

    // Insert new OTP
    await queryDatabase(queries.insertEmailOtp, [
      email,
      username,
      otp,
      createdAt,
      expiresAt,
      0
    ]);

    // send email (nodemailer or fallback logger)
    await sendOtpEmail(email, otp);

    // OTP Send
    return res.json({
      status: 'success',
      message: SUCCESS_MESSAGES.OTP_SENT_TO_EMAIL_VERFICATION
    });

  } catch (error) {
    console.error('sendEmailOtp error:', error);

    return res.status(500).json({
      status: 'error',
      error: 'INTERNAL_SERVER_ERROR_SENDING_OTP',
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR_SENDING_OTP
    });
  }
}

// Verifying OTP
const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        status: 'error',
        error: 'MISSING_EMAIL_OR_OTP',
        message: ERROR_MESSAGES.MISSING_EMAIL_OR_OTP
      });
    }

    // Get latest unexpired, unused OTP
    const [latestOtpRows] = await queryDatabase(`SELECT * FROM ${TABLES.EMAIL_OTP_REGISTER} WHERE email = ? AND status = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`, [email]);

    // No OTP found
    if (!latestOtpRows || latestOtpRows.length === 0) {
      return res.status(400).json({
        status: 'error',
        error: 'INVALID_EXPIRED_OTP',
        message: ERROR_MESSAGES.INVALID_EXPIRED_OTP
      });
    }

    const latestOtp = latestOtpRows[0];

    // Compare OTP
    if (latestOtp.email_otp !== otp) {
      return res.status(400).json({
        status: 'error',
        error: 'INVALID_EXPIRED_OTP',
        message: ERROR_MESSAGES.INVALID_EXPIRED_OTP
      });
    }

    // Mark OTP as used
    await queryDatabase(
      `UPDATE ${TABLES.EMAIL_OTP_REGISTER} SET status = 1 WHERE id = ?`,
      [latestOtp.id]
    );

    return res.status(200).json({
      status: 'success',
      message: SUCCESS_MESSAGES.OTP_VERIFIED_SUCCESSFUL
    });

  } catch (err) {
    console.error('verifyEmailOtp error:', err);

    return res.status(500).json({
      status: 'error',
      error: 'INTERNAL_SERVER_ERROR_VERFIYING_OTP',
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR_VERFIYING_OTP
    });
  }
};


// Forgot Email OTP
const sendForgotPasswordOTP = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        status: 'error',
        error: 'EMAIL_REQUIRED',
        message: 'Kindly enter your Email ID'
      })
    }

    // check the email already exist 
    const [rows] = await queryDatabase(queries.getUserByEmail, [email]);
    if (!rows || rows.length === 0) {
      return res.status(400).json({
        status: "error",
        message: 'Please create an account before trying to reset your password.'
      })
    }

    const user = rows[0];

    // Generate OTP
    const otp = otpGenerator.generate(4, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });
    const now = new Date();
    const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000)

    await queryDatabase(`UPDATE ${TABLES.REGISTER} SET forgot_password_code = ?,forgot_password_time=?,forgot_password_timestamp=?,forgot_password_code_expires_at=? WHERE email = ?`,
      [otp, now.toISOString().slice(0, 19).replace("T", " "), now.toISOString().slice(0, 19).replace("T", " "), expiresAt, email]);

    // send email with otp 
    await sendForgotPasswordOtpEmail(email, otp);

    return res.json({
      status: "success",
      message: "An OTP has been sent to your email. Please check your inbox"
    })

  } catch (error) {
    console.error("sendForgotPasswordOTP :", error);
    return res.status(500).json({ status: 'error', message: "Internal server error" })
  }
}

// verfiy forgot otp 

const verifyForgotPasswordOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ status: "error", message: "Email and OTP are required" });
    }

    const sql = `SELECT forgot_password_code, forgot_password_code_expires_at FROM ${TABLES.REGISTER} WHERE email = ?`;
    const [rows] = await queryDatabase(sql, [email]);

    if (!rows || rows.length === 0) {
      return res.status(400).json({ status: 'error', message: 'User not found' });
    }

    const user = rows[0];
    const now = new Date();

    if (user.forgot_password_code !== otp) {
      return res.status(400).json({ status: 'error', message: 'Invalid OTP' });
    }

    if (new Date(user.forgot_password_code_expires_at) < now) {
      return res.status(400).json({ status: 'error', message: 'OTP expired' });
    }

    // // Mark OTP as used
    // await queryDatabase(`UPDATE ${REGISTER} SET forgot_password_code = NULL WHERE email = ?`, [email]);

    return res.json({ status: 'success', message: 'OTP verified successfully' });

  } catch (error) {
    console.error('verifyForgotPasswordOtp error:', error);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

// Change password

const changePassword = async (req, res) => {
  try {
    const { user_id, oldPassword, newPassword, confirmPassword } = req.body;

    if (!user_id || !oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        status: "error",
        message: "All fields are required"
      });
    }

    // get user by ID

    const [rows] = await queryDatabase(`SELECT id, email, password FROM ${TABLES.REGISTER} WHERE id = ?  `, [user_id]);

    if (!rows || rows.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "User not found",
      });
    }

    const user = rows[0];

    // check old password

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        status: "error",
        message: "Old Password is incorrect",
      });
    }

    // compare new and confrim password

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        status: "error",
        message: "New password and confirm password is not matching",
      });
    }

    // set a password

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS || 10);
    const hashedconfirmPassword = await bcrypt.hash(confirmPassword, BCRYPT_SALT_ROUNDS || 10);

    await queryDatabase(`UPDATE ${TABLES.REGISTER} SET password = ?, confirm_password = ? WHERE id =?`, [hashedPassword, hashedconfirmPassword, user_id]);

    return res.status(200).json({
      status: "success",
      message: "Password changed successfully, Redirect to Login."
    })

  } catch (error) {
    console.error("Password error", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error"
    })

  }
}

// Resen otp 

const resendForgotOtp = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) return res.status(400).json({
      status: "error", message: "Email is required"
    })

    const [rows] = await queryDatabase(`SELECT * FROM ${TABLES.REGISTER} WHERE email = ?`, [email]);
    if (!rows.length) return res.status(400).json({ status: "error", message: "User not found" });

    // otp experies in 5 minutes 
    const otp = otpGenerator.generate(4, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });
    const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

    await queryDatabase(`UPDATE ${TABLES.REGISTER} SET forgot_password_code = ?, forgot_password_code_expires_at = ? WHERE email = ?`,
      [otp, expiresAt, email])

    // send email with otp 
    await sendForgotPasswordOtpEmail(email, otp);

    return res.json({ status: "success", message: "New OTP sent to your email" });

  } catch (error) {
    console.error("resendForgotPasswordOtp error:", error);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

// Reset the password

const resetPassword = async (req, res) => {

  try {
    const { email, password, confirmPassword } = req.body;
    if (!email || !password || !confirmPassword) {
      return res.status(400).json({ message: "Missing Fields" })
    }
    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "password do not match"
      })
    }
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const hashedConfirm = await bcrypt.hash(confirmPassword, BCRYPT_SALT_ROUNDS);

    const [result] = await queryDatabase(`UPDATE ${TABLES.REGISTER} SET password = ?,confirm_password=? WHERE email = ?`, [hashedPassword, hashedConfirm, email]);

    if (result.affectedRows === 0) {
      return res.status(400).json({
        message: "User not found"
      })
    }

    return res.json({
      status: "success",
      message: "Your password updated"
    })

  } catch (error) {
    console.error("resetPassword error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function getPublicIP() {
  try {
    const res = await axios.get("https://api.ipify.org?format=json");
    return res.data.ip;
  } catch (err) {
    console.error("Failed to fetch public IP:", err);
    return null;
  }
}

// complete registration: create user after OTP verified
const completeRegistration = async (req, res) => {
  try {
    const { username, email, password, confirmPassword, whatsapp_number, referred_by_id } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({
        status: 'error',
        error: 'MISSING_FIELDS',
        message: ERROR_MESSAGES.MISSING_FIELDS,
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        status: 'error',
        error: 'PASSWORD_DOESNT_MATCH',
        message: ERROR_MESSAGES.PASSWORD_DOESNT_MATCH
      });
    }

    if(!whatsapp_number) {
      return res.status(400).json({
        status: 'error',
        error: 'MISSING_WHATSAPP_NUMBER',
        message: ERROR_MESSAGES.MOBILE_WHATSAPP_NUMBERS
      })
    }

    const passError = validatePassword(password);
    if (passError) return res.status(400).json({ error: passError });

    // check if email already exists
    const [existing] = await queryDatabase(queries.getUserByEmail, [email]);
    if (existing && existing.length > 0) {
      return res.status(400).json({
        status: 'error',
        error: 'EMAIL_ALREADY_EXISTS',
        message: ERROR_MESSAGES.EMAIL_ALREADY_EXISTS
      });
    }

    // ensure OTP was verified for this email (status = 1)
    const [usedRows] = await queryDatabase(queries.getUsedOtpForEmail, [email]);
    if (!usedRows || usedRows.length === 0) {
      return res.status(400).json({
        status: 'error',
        error: 'EMAIL_NOT_VERIFIED',
        message: ERROR_MESSAGES.EMAIL_NOT_VERIFIED
      });
    }

    // ---- NEW: Fetch user IP ----
    const ip_address =await getPublicIP();
    console.log("User IP:", ip_address);

    // hash password and insert user
    const hashed = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const [userResult] = await queryDatabase(queries.insertUser, [
      username,
      email,
      hashed,
      hashed, // confrim password
      whatsapp_number,
      new Date(),
      referred_by_id || null,
      ip_address
    ]);

    const newUserId = userResult.insertId;

    // ALWAYS set referral_id = user.id
    await queryDatabase(`UPDATE ${TABLES.REGISTER} SET referral_id = ? WHERE id = ?`, [newUserId, newUserId]);

    // Create IB bonus row
    await queryDatabase(`INSERT INTO ${TABLES.ADMIN_BONUS}  (user_id, ib_kyc_status, total_earnings, created_at) VALUES (?, 'pending', 0, NOW())`, [newUserId]);

      return res.json({ 
        status: 'success',
        message: SUCCESS_MESSAGES.REGISTERATION_COMPLETE 
      });

  } catch (err) {
    console.error('completeRegistration error:', err);

    return res.status(500).json({
      status: 'error',
      error: 'INTERNAL_SERVER_ERROR_REGISTERATION',
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR_REGISTERATION
    });
  }
};

const addUser = async (req, res) => {
  try {
    const { user_name, email, password, confirm_password, whatsapp} = req.body;

    // Validation
    if (!user_name || !email || !password || !confirm_password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password !== confirm_password) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // const valideGender = ["Male", "Female", "Others"];
    // if (!valideGender.includes(gender)) {
    //   return res.status(400).json({ message: "Invalid gender value" });
    // }

    // Check if email already exists
    const [existingUser] = await queryDatabase(`SELECT * FROM ${TABLES.REGISTER} WHERE email = ?`, [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedConfirmPassword = await bcrypt.hash(confirm_password, 10);

    // Insert User
    const sql = `
      INSERT INTO ${TABLES.REGISTER} 
      (username, email, password, confirm_password, whatsapp_number, account_created_at, account_created_timestamp)
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;
    await queryDatabase(sql, [user_name, email, hashedPassword, hashedConfirmPassword, whatsapp]);

    return res.status(201).json({ message: "User added successfully!" });
  } catch (error) {
    console.error("Error adding user:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


// Fetch user profile 

const getProfile = async (req, res) => {
  try {
    const userid = req.user?.id;
    if (!userid) {
      return res.status(400).json({
        status: "error",
        error: "USER_NOT_FOUND",
        message: "User not found in token"
      })
    }

    const sql = `SELECT id,username, email,whatsapp_number,date_of_birth,nationality,country,address,city,referred_by_id,employment_status,source_of_income,trading_experience,income_range,occupation, profile_completed FROM ${TABLES.REGISTER} WHERE id = ?`
    const [rows] = await queryDatabase(sql, [userid]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      })
    }
    return res.json({
      status: "success",
      data: rows[0],
    })
  } catch (error) {
    console.error("getProfile", error);
    return res.status(500).json({
      status: 'error',
      message: "Failed to fetch the data"
    })
  }
}

// User Profile Details 

// const updateProfile = async (req, res) => {
//   try {
//     const userid = req.user?.id;
//     const { username, email, whatsapp_number,date_of_birth,nationality,country,address,city,referred_by_id,employment_status,source_of_income,trading_experience,income_range,occupation} = req.body

//     if (!userid) {
//       return res.status(400).json({
//         status: 'error',
//         error: 'USER_NOT_FOUND',
//         message: 'No User founded in this id'
//       })
//     }

//     const sql = `UPDATE ${TABLES.REGISTER} set username = ?,email = ?, whatsapp_number=?, date_of_birth=?,nationality=?,country=?,address=?,city=?,referred_by_id=?,employment_status=?,source_of_income=?,trading_experience=?,income_range=?,occupation=?  WHERE id = ?`

//     const [result] = await queryDatabase(sql, [username, email, whatsapp_number,date_of_birth,nationality,country,address,city,referred_by_id,employment_status,source_of_income,trading_experience,income_range,occupation,userid])
//     if (result.affectedRows === 0) {
//       return res.status(400).json({
//         status: 'error',
//         error: 'row not founded',
//         message: "no row founded in this id"
//       })
//     }
//     return res.json({
//       status: 'success',
//       message: SUCCESS_MESSAGES.PROFILE_CREATED,
//     })

//   } catch (error) {
//     console.error('updatedProfileerror', error)
//     return res.status(500).json({
//       status: 'error',
//       message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
//       error: error.message
//     })
//   }
// }





const updateProfile = async (req,res) => {
  try {
    const userid = req.user?.id;

    if (!userid) {
      return res.status(400).json({
        status: 'error',
        error: 'USER_NOT_FOUND',
        message: 'No User founded in this id'
      })
    };
    // check if profile is completed
    const [check] = await queryDatabase(`SELECT profile_completed FROM ${TABLES.REGISTER} WHERE id = ?`, [userid]);
    if (check[0]?.profile_completed === 1){
      return res.status(403).json({
        status:"error",
        message:"Already completed!"
      })
    }
    const {date_of_birth,nationality,country,address,city,referred_by_id,employment_status,source_of_income,trading_experience,income_range,occupation} = req.body;

    const sql = `UPDATE ${TABLES.REGISTER} SET date_of_birth = ?,nationality = ?,
    country = ?,address = ?,city = ?,referred_by_id = ?,employment_status = ?,source_of_income = ?,trading_experience = ?,income_range = ?,occupation = ?,
    profile_completed=1 WHERE id=?`;

    await queryDatabase(sql, [date_of_birth, nationality, country, address, city, referred_by_id, employment_status,source_of_income, trading_experience, income_range, occupation, userid])
    return res.json({
      status: 'success',
      message: SUCCESS_MESSAGES.PROFILE_CREATED,
    });

  } catch (error) {
    console.error('updatedProfileerror', error)
    return res.status(500).json({
      status: 'error',
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      error: error.message
    })
  }
}

const applyReferral = async (req, res) => {
  try {
    const { email, referral_code } = req.body;

    if (!email || !referral_code) {
      return res.status(400).json({ error: 'Email and Referral code are required' });
    }

    // Get current user
    const [currentUserRows] = await queryDatabase(
      `SELECT id, referred_by_id FROM ${TABLES.REGISTER} WHERE email = ?`,
      [email]
    );

    if (!currentUserRows || currentUserRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const currentUserId = currentUserRows[0].id;

    // Prevent user applying referral again
    if (currentUserRows[0].referred_by_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Referral code already applied',
        error: "REFERRA_CODE_ALREADY_APPLIED"
      });
    }

    //  Do NOT allow referral code = user's own ID
    if (String(referral_code) === String(currentUserId)) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot use your own referral code'
      });
    }

    // Check if referral_code exists in DB
    const [referrerRows] = await queryDatabase(
      `SELECT id FROM ${TABLES.REGISTER} WHERE id = ?`,
      [referral_code]
    );

    if (!referrerRows || referrerRows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid referral code'
      });
    }

    const referrerId = referrerRows[0].id;

    // Save referred_by_id = user typed referral code
    await queryDatabase(
      `UPDATE ${TABLES.REGISTER} SET referred_by_id = ? WHERE id = ?`,
      [referrerId, currentUserId]
    );

    return res.json({
      status: 'success',
      message: SUCCESS_MESSAGES.REFERRAL_APPLIED
    });

  } catch (err) {
    console.error('applyReferral error:', err);
    return res.status(500).json({
      status: 'error',
      error: 'INTERNAL_SERVER_ERROR_REFERRAL',
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR_REFERRAL
    });
  }
};


// Login

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        error: 'MISSING_FIELDS',
        message: ERROR_MESSAGES.MISSING_FIELDS
      });
    }

    const [rows] = await queryDatabase(queries.getUserByEmail, [email]);

    // check user status
    const user = rows[0];
    if (user?.user_status && user?.user_status?.toLowerCase() === "inactive") {
      return res.status(403).json({
        status: "error",
        error: "INACTIVE_ACCOUNT",
        message: ERROR_MESSAGES.INACTIVE_ACCOUNT,
      });
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({
        status: 'error',
        error: 'CREATE_AN_ACCOUNT_FIRST',
        message: ERROR_MESSAGES.CREATE_AN_ACCOUNT_FIRST,
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Generate JWT with tokenVersion
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, tokenVersion: user.token_version || 1 },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "12h" }
    );

    console.log("token", token)

    // Store value in users_login table
    const loginSource = req.body.login_source || "website";

    await queryDatabase(
      `INSERT INTO ${TABLES.USER_LOGIN_HISTORY} (user_id, action, login_source) 
       VALUES (?, 'login', ?)`,
      [user.id, loginSource]
    );

    return res.json({
      status: 'success',
      message: SUCCESS_MESSAGES.LOGIN_SUCCESS,
      token,
      user: {
        user_id: user.id,
        username: user.username,
        email: user.email,
      },
      redirect: "/dashboard",
    });
  } catch (err) {
    console.error("login error:", err);

    return res.status(500).json({
      status: 'error',
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR_LOGIN,
      error: 'INTERNAL_SERVER_ERROR_LOGIN',
    });
  }
}


//  Token blacklist array
const tokenBlacklist = [];

// Middleware to protect routes
// const authMiddleware = (req, res, next) => {
//   try {
//     const authHeader = req.headers["authorization"];
//     if (!authHeader) {
//       return res.status(401).json({
//         status: 'error',
//         error: 'UNAUTHORIZED',
//         message: 'Authorization token is missing'
//       });
//     }

//     const token = authHeader.split(" ")[1];
//     if (!token) {
//       return res.status(401).json({
//         status: 'error',
//         error: 'UNAUTHORIZED',
//         message: 'Authorization token is missing'
//       });
//     }

//     // Check if token is blacklisted
//     if (tokenBlacklist.includes(token)) {
//       return res.status(401).json({
//         status: 'error',
//         error: 'TOKEN_BLACKLISTED',
//         message: 'This token has been logged out'
//       });
//     }

//     // Verify token
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded;
//     next();
//   } catch (err) {
//     console.error('authMiddleware error:', err);
//     return res.status(401).json({
//       status: 'error',
//       error: 'INVALID_OR_EXPIRED_TOKEN',
//       message: 'Token is invalid or expired'
//     });
//   }
// };

// Middleware to protect routes
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        error: "UNAUTHORIZED",
        message: "Authorization token is missing",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        status: "error",
        error: "UNAUTHORIZED",
        message: "Authorization token is missing",
      });
    }

    // Check if token is blacklisted
    if (tokenBlacklist.includes(token)) {
      return res.status(401).json({
        status: "error",
        error: "TOKEN_BLACKLISTED",
        message: "This token has been logged out",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // DB user status check
    const [rows] = await queryDatabase(
      `SELECT id, username, email, user_status, token_version
       FROM users 
       WHERE id = ?`,
      [decoded.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        status: "error",
        error: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    const user = rows[0];
    const userStatus = String(user.user_status || "").toLowerCase();

    if (userStatus !== "active") {
      return res.status(403).json({
        status: "error",
        error: "INACTIVE_ACCOUNT",
        message: "Your account has been deactivated. Please contact admin.",
      });
    }

    // Check token_version: if JWT token_version doesn't match DB token_version, token is invalidated
    const jwtTokenVersion = decoded.tokenVersion || 1;
    const dbTokenVersion = user.token_version || 1;

    if (jwtTokenVersion !== dbTokenVersion) {
      return res.status(401).json({
        status: "error",
        error: "SESSION_EXPIRED",
        message: "Your session has expired. Please log in again.",
      });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      user_status: user.user_status,
    };

    next();
  } catch (err) {
    console.error("authMiddleware error:", err);

    return res.status(401).json({
      status: "error",
      error: "INVALID_OR_EXPIRED_TOKEN",
      message: "Token is invalid or expired",
    });
  }
};

// logout
const logout = async (req, res) => {
  try {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(400).json({
      status: 'error',
      error: 'NO_TOKEN',
      message: ERROR_MESSAGES.NO_TOKEN,
    });

    // add token to blacklist
    tokenBlacklist.push(token);

    // Logout store in users_login table
    // App/Web body la login_source send pannum, illana default "website"
    const logoutSource = req.body.login_source || "website";

    await queryDatabase(
      `INSERT INTO ${TABLES.USER_LOGIN_HISTORY} (user_id, action, login_source) 
       VALUES (?, 'logout', ?)`,
      [req.user.id, logoutSource]
    );

    return res.json({
      status: 'success',
      message: SUCCESS_MESSAGES.LOGOUT_SUCCESFUL
    });

  } catch (err) {
    console.error("logout error:", err);

    return res.status(500).json({
      status: 'error',
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR_LOGOUT,
      error: 'INTERNAL_SERVER_ERROR_LOGOUT',
    });
  }
}

// Admin Fetch all form back to front

const getAllUsers = async (req, res) => {
  try {
    const [rows] = await queryDatabase(`SELECT id, email, account_created_timestamp, whatsapp_number,account_created_at, photo_verification_status, user_status, is_lp_added, ib_status FROM ${TABLES.REGISTER} ORDER BY id DESC`);
    const sanitizedRows = rows.map(user => {
      const { password, confirm_password, forgot_password_code, ...rest } = user;
      return rest;
    });

    return res.json({
      status: "success",
      data: sanitizedRows,
    });

  } catch (error) {
    console.error("getAllusers error", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch users"
    });
  }
};

const getInactiveUsers = async (req, res) => {
  try {
    const [rows] = await queryDatabase(`SELECT id, email, account_created_timestamp, whatsapp_number,account_created_at, photo_verification_status, user_status, is_lp_added, ib_status FROM ${TABLES.REGISTER} WHERE user_status = 'inactive' ORDER BY id DESC`);
    const sanitizedRows = rows.map(user => {
      const { password, confirm_password, forgot_password_code, ...rest } = user;
      return rest;
    });

    return res.json({
      status: "success",
      data: sanitizedRows,
    });

  } catch (error) {
    console.error("getInactiveUsers error", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch inactive users"
    });
  }
};

const getAllMonitorUsers = async (req, res) => {
  try {
    const [rows] = await queryDatabase(`
      SELECT 
        id,
        username,
        email,
        whatsapp_number,
        user_status,
        ib_status,
        is_lp_added,
        monitor_status,
        account_created_at
      FROM ${TABLES.REGISTER}
      WHERE monitor_status = 1
      ORDER BY id DESC
    `);

    const sanitizedRows = rows.map((user) => {
      const {
        password,
        confirm_password,
        forgot_password_code,
        ...rest
      } = user;

      return rest;
    });

    return res.json({
      status: "success",
      total: sanitizedRows.length,
      data: sanitizedRows,
    });

  } catch (error) {
    console.error("getAllMonitorUsers error:", error);

    return res.status(500).json({
      status: "error",
      message: "Failed to fetch monitor users",
      error: error.message,
    });
  }
};

// Admin single user by id

const getSingleUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: "error",
        message: "USER ID is required",
      });
    }

    const [rows] = await queryDatabase(`SELECT 
      id, username, email, whatsapp_number, date_of_birth, nationality, country, city, ib_status, monitor_status, user_status, is_lp_added,referred_by_id FROM ${TABLES.REGISTER} WHERE id =?`, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const user = rows[0];
    return res.json({
      status: "success",
      data: user,
    })

  } catch (error) {
    console.error("Getsingle user error", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch data"
    });
  }
};

// Admin update status by id 

const updateByUser = async (req, res) => {
  try {
    const { id } = req.params; // comes automatically from /api/auth/user/status/:id
    const { user_status, is_lp_added, ib_status, monitor_status } = req.body;

    if (!id || !user_status) {
      return res.status(400).json({
        status: "error",
        message: "User ID and user_status are required",
      });
    }

    const normalizedUserStatus = user_status.toLowerCase();

    if (!["active", "inactive"].includes(normalizedUserStatus)) {
      return res.status(400).json({
        status: "error",
        message: "user_status must be 'active' or 'inactive'",
      });
    }

    // LP status
    let lpValue = null;
    if (is_lp_added !== undefined) {
      lpValue = Number(is_lp_added);
      if (![0, 1].includes(lpValue)) {
        return res.status(400).json({
          status: "error",
          message: "is_lp_added must be 0 or 1",
        });
      }
    }

        // Monitor status
    let monitorValue = null;

    if (monitor_status !== undefined) {
      monitorValue = Number(monitor_status);

      if (![0, 1].includes(monitorValue)) {
        return res.status(400).json({
          status: "error",
          message: "monitor_status must be 0 or 1",
        });
      }
    }

    // IB status logic
    let finalIbStatus = null;

    if (normalizedUserStatus === "inactive") {
      finalIbStatus = "inactive";
    } else if (ib_status) {
      const normalizedIbStatus = ib_status.toLowerCase();
      if (!["active", "inactive"].includes(normalizedIbStatus)) {
        return res.status(400).json({
          status: "error",
          message: "ib_status must be 'active' or 'inactive'",
        });
      }
      finalIbStatus = normalizedIbStatus;
    }

    const [result] = await queryDatabase(`UPDATE ${TABLES.REGISTER} SET user_status = ?, ib_status = COALESCE(?, ib_status), is_lp_added = COALESCE(?, is_lp_added), monitor_status = COALESCE(?, monitor_status)
      WHERE id = ?`, [normalizedUserStatus, finalIbStatus, lpValue, monitorValue, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found or no changes applied",
      });
    }

    return res.json({
      status: "success",
      message: `User status changed to '${user_status}' successfully.`,
    });
  } catch (error) {
    console.error("updateByUser error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to update user status",
    });
  }
};

// const updateByUser = async (req, res) => {
//   try {
//     const { id } = req.params; // comes automatically from /api/auth/user/status/:id
//     const { user_status, is_lp_added, ib_status } = req.body;

//     if (!id || !user_status) {
//       return res.status(400).json({
//         status: "error",
//         message: "User ID and user_status are required",
//       });
//     }

//     const normalizedUserStatus = user_status.toLowerCase();

//     if (!["active", "inactive"].includes(normalizedUserStatus)) {
//       return res.status(400).json({
//         status: "error",
//         message: "user_status must be 'active' or 'inactive'",
//       });
//     }

//     const [rows] = await queryDatabase(`SELECT is_lp_added, ib_status FROM ${TABLES.REGISTER} WHERE id = ?`, [id]);

//     let lpValue = rows[0].is_lp_added;
//     let finalIBStatus = rows[0].ib_status;
//     // LP status
//     if (is_lp_added !== undefined) {
//       newLp = Number(is_lp_added);
//       if (![0, 1].includes(newLp)) {
//         return res.status(400).json({
//           status: "error",
//           message: "is_lp_added must be 0 or 1",
//         });
//       }
//       lpValue = newLp
//     }

//     // IB status logic

//     if (normalizedUserStatus === "inactive") {
//       finalIBStatus = "inactive";
//     } else if (ib_status !== undefined) {
//       const normalizedIbStatus = ib_status.toLowerCase();
//       if (!["active", "inactive"].includes(normalizedIbStatus)) {
//         return res.status(400).json({
//           status: "error",
//           message: "ib_status must be 'active' or 'inactive'",
//         });
//       }
//       finalIBStatus = normalizedIbStatus;
//     }

//     const [result] = await queryDatabase(`UPDATE ${TABLES.REGISTER} SET user_status = ?, is_lp_added = ?, ib_status = ?
//       WHERE id = ?`, [normalizedUserStatus, finalIBStatus, lpValue, id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({
//         status: "error",
//         message: "User not found or no changes applied",
//       });
//     }

//     return res.json({
//       status: "success",
//       message: "User status updated successfully",
//     });
//   } catch (error) {
//     console.error("updateByUser error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: "Failed to update user status",
//     });
//   }
// };

// Loginhistory

const getUserLoginHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ status: "error", message: "User id is required" });
    }

    const sql = `SELECT id, user_id, created_at, login_source, action FROM ${TABLES.USER_LOGIN_HISTORY} WHERE user_id=? ORDER BY created_at DESC`;
    const [rows] = await queryDatabase(sql, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No login record found"
      })
    }
    return res.json({
      status: "success",
      data: rows
    });

  } catch (error) {
    console.error("getUserLoginHistory error:", error);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

// Admin Manual Force Logout - Increment token_version to invalidate all existing tokens
const manualLogout = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        status: "error",
        error: "MISSING_FIELDS",
        message: "user_id is required"
      });
    }

    // Validate that user exists
    const [userRows] = await queryDatabase(
      `SELECT id, token_version FROM ${TABLES.REGISTER} WHERE id = ?`,
      [user_id]
    );

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({
        status: "error",
        error: "USER_NOT_FOUND",
        message: "User not found"
      });
    }

    const user = userRows[0];
    const newTokenVersion = (user.token_version || 1) + 1;

    // Increment token_version by 1 (invalidates all existing tokens for this user)
    await queryDatabase(
      `UPDATE ${TABLES.REGISTER} SET token_version = ? WHERE id = ?`,
      [newTokenVersion, user_id]
    );

    return res.json({
      status: "success",
      message: "User has been force logged out. All their existing tokens are now invalid."
    });

  } catch (error) {
    console.error("manualLogout error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to force logout user",
      error: error.message
    });
  }
};



module.exports = {
  sendEmailOTP,
  verifyEmailOtp,
  sendForgotPasswordOTP,
  verifyForgotPasswordOtp,
  changePassword,
  resetPassword,
  resendForgotOtp,
  completeRegistration,
  // updateContactNumbers,
  applyReferral,
  getProfile,
  updateProfile,
  login,
  authMiddleware,
  logout,
  getAllUsers,
  getInactiveUsers,
  getAllMonitorUsers,
  getSingleUser,
  updateByUser,
  addUser,
  getUserLoginHistory,
  manualLogout
}
