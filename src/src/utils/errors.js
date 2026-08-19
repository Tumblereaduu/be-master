const ERROR_MESSAGES = {
    MISSING_FIELDS: 'Kindly enter the fields to proceed!',
    INVALID_CREDENTIALS: 'Invalid username or password.',
    EMAIL_ALREADY_EXISTS: 'Email already exists, try to use another email.',
    UNAUTHORIZED_ACCESS: 'You are not authorized to perform this action.',
    USER_NOT_FOUND: 'User not found.',
    INTERNAL_SERVER_ERROR: 'Something went wrong. Please try again later.',
    INTERNAL_SERVER_ERROR_SENDING_OTP: 'Something went wrong while sending OTP. Please try again later or Contact support.',
    INTERNAL_SERVER_ERROR_VERFIYING_OTP: 'Something went wrong while verifying OTP. Please try again later or Contact support.',

    // OTP Verification
    MISSING_EMAIL_OR_OTP: 'Please provide both email and OTP.',
    INVALID_EXPIRED_OTP: 'The OTP you entered is invalid or has expired.',
    EMAIL_NOT_VERIFIED: 'Email not verified. Please verify OTP first.',


    // Registeration
    PASSWORD_DOESNT_MATCH: 'Passwords do not match',
    INTERNAL_SERVER_ERROR_REGISTERATION: 'Something went wrong while registering your account. Please try again later or Contact support.',

    // Contact numbers
    MOBILE_WHATSAPP_NUMBERS: 'Please provide whatsapp number',
    INTERNAL_SERVER_ERROR_NUMBERS: 'Something went wrong while updating your numbers. Please try again later or Contact support.',

    // 
    INTERNAL_SERVER_ERROR_REFERRAL: 'Something went wrong while applying referral. Please try again later or Contact support.',

    // login
    CREATE_AN_ACCOUNT_FIRST: 'You have not registered your account, Kindly register your account',
    // INACTIVE_ACCOUNT : "Kindly contact the DOINFX team",
    INACTIVE_ACCOUNT : "Your Account has been deactivated",
    INTERNAL_SERVER_ERROR_LOGIN: 'Something went wrong while login your account. Please try again later or Contact support.',

    // Logout
    NO_TOKEN: 'No token provided',
    INTERNAL_SERVER_ERROR_LOGOUT: 'Something went wrong while logout your account. Please try again later or Contact support.',

    // Middleware
    UNAUTHORIZED: 'Unauthorized',
    TOKEN_BLACKLIST: 'Token is blacklisted (logged out)',
    INVALID_EXPIRED_TOKEN: 'Invalid or expired token',

    // DEPSOIT
    DEPOSIT_CREATION_FAILED: 'Deposit creation failed.',
    DEPOSIT_FETCH_FAILED: 'Could not fetch deposits.',
    DEPOSIT_UPDATE_FAILED: 'Failed to update deposit.',

    // Withdrawal

    WITHDRAWAL_CREATION_FAILED: 'Withdrawal creation failed.',
    WITHDRAWAL_FETCH_FAILED: 'Could not fetch withdrawals.',
    WITHDRAWAL_UPDATE_FAILED: 'Failed to update withdrawal status.',
    WITHDRAWAL_NOT_FOUND: 'Withdrawal not found.',
    MINIMUM_WITHDRAWAL_AMOUNT: 'The requested amount is below the minimum allowed.',

    // KYC
    KYC_SUBMISSION_FAILED: 'KYC submission failed.',
    KYC_FETCH_FAILED: 'Could not fetch KYC information.',
    KYC_UPDATE_FAILED: 'Failed to update KYC status.',
    KYC_NOT_FOUND: 'KYC information not found.',


    // Profile
    PROFILE_USER: "No User Founded In This ID",
};

const SUCCESS_MESSAGES = {
    OTP_SENT_TO_EMAIL_VERFICATION: 'An OTP is send to your email address for verification, Kindly check your email.',
    OTP_VERIFIED_SUCCESSFUL: 'OTP verified successfully',

    // REGISTERATION
    PASSWORD_SET: 'Password set successfully.',
    REGISTERATION_COMPLETE: 'Registration successful. Please log in to continue.',
    CONTACT_NUMBERS_SAVED: 'Contact numbers saved, proceed to referral',
    REFERRAL_APPLIED: 'Referral applied. Redirect to login.',

    // LOGIN
    LOGIN_SUCCESS: "You have been securely logged!",

    // LOGOUT
    LOGOUT_SUCCESFUL: 'You have been securely logged out!',
    // KYC
    KYC_PROOF_SUBMITTED: 'Your KYC details have been successfully submitted, documents are under review.',
    KYC_STATUS_UPDATED: 'KYC status updated successfully.',

    // Deposit
    DEPOSIT_CREATED: 'Deposit submitted successfully.',
    DEPOSIT_UPDATED: 'Deposit updated successfully.',

    // WITHDRAWAL
    WITHDRAWAL_CREATED: 'Withdrawal request submitted successfully.',
    WITHDRAWAL_UPDATED: 'Withdrawal status updated successfully.',

    // SUPPORT 

    TICKET_CREATED: 'Ticket submitted successfully.',
    TICKET_REPLIED: 'Reply added to ticket successfully.',

    // Profile
    PROFILE_CREATED: "Profile Updated Successfully",

    // Set Values
    SETVALUES_CREATED: "Payment and Status Updated",

    // Admin Login
    ADMIN_LOGIN : "Added successfully",
};

module.exports = { ERROR_MESSAGES, SUCCESS_MESSAGES };
