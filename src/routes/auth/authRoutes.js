const express = require('express');
const router = express.Router();
const authController = require('../../controllers/auth/authController');
const { loginRateLimiter } = require('../../middleware/loginRateLimiter');

router.post('/send-email-otp', authController.sendEmailOTP);
router.post('/verify-email-otp', authController.verifyEmailOtp);
router.post("/verify-forgot-password-otp", authController.verifyForgotPasswordOtp);
router.post('/forgot-password', authController.sendForgotPasswordOTP);
router.post("/resend-forgot-password-otp", authController.resendForgotOtp);
router.post("/change-password", authController.changePassword);
router.post('/reset-password', authController.resetPassword);
router.post('/register', authController.completeRegistration);
router.post('/admin/add',authController.addUser);
// router.put('/update-contact', authController.updateContactNumbers);
router.put('/apply-referral', authController.applyReferral);
router.get('/profile/details', authController.authMiddleware, authController.getProfile);
router.get('/all-users',authController.getAllUsers);
router.get('/inactive-users',authController.getInactiveUsers);
router.get('/monitor-users',authController.getAllMonitorUsers);
router.get('/user/:id',authController.getSingleUser);
router.put('/profile/update', authController.authMiddleware, authController.updateProfile);
router.put('/user/status/:id',authController.updateByUser);

// TASK 5: Apply rate limiting to login endpoint to prevent brute force attacks
router.post("/login", loginRateLimiter, authController.login);

router.post("/logout", authController.authMiddleware,authController.logout);
router.get("/user-login/:id",authController.getUserLoginHistory);
router.post("/manual-logout",authController.manualLogout);


module.exports = router;
