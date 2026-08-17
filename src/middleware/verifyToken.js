const jwt = require('jsonwebtoken');

function signToken(payload, expiresIn = process.env.JWT_EXPIRES_IN || '7d') {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');
    return jwt.sign(payload, secret, { expiresIn });
}

/*
  Middleware: verifyToken
  - Verifies JWT from Authorization header
  - Supports roles: master, admin, user
  - Sets req.user according to decoded.role:
      master -> { role: 'master', master_id }
      admin  -> { role: 'admin', admin_id, master_id }
      user   -> { role: 'user', user_id, admin_id, master_id }
*/
module.exports = (req, res, next) => {
    try {
        const auth = req.headers.authorization || req.headers.Authorization || '';
        if (!auth.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }
        const token = auth.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('JWT_SECRET not set');
            return res.status(500).json({ success: false, message: 'Server configuration error' });
        }
        let decoded;
        try {
            decoded = jwt.verify(token, secret);
        } catch (err) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
        // Support master, admin, user
        if (decoded.role === 'master') {
            req.user = {
                role: 'master',
                master_id: decoded.master_id,
                tokenVersion: decoded.tokenVersion
            };
            return next();
        }
        if (decoded.role === 'admin') {
            req.user = {
                role: 'admin',
                admin_id: decoded.admin_id,
                master_id: decoded.master_id,
                tokenVersion: decoded.tokenVersion
            };
            return next();
        }
        if (decoded.role === 'user') {
            req.user = {
                role: 'user',
                user_id: decoded.user_id,
                admin_id: decoded.admin_id,
                master_id: decoded.master_id,
                tokenVersion: decoded.tokenVersion
            };
            return next();
        }
        // Unknown role
        return res.status(403).json({ success: false, message: 'Forbidden' });
    } catch (err) {
        console.error('verifyToken error', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
