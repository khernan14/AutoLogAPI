import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Agrega el usuario decodificado al objeto de solicitud
        next();
    } catch (error) {
        res.status(400).json({ error: 'Token inválido' });
    }
};

export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.rol)) {
            return res.status(403).json({ error: 'No tienes permiso para realizar esta acción' });
        }
        next();
    };
};