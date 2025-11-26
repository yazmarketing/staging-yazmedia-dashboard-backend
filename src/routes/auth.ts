import { Router } from 'express';
import { login, googleAuth } from '../controllers/authController';

const router = Router();

/**
 * @route   POST /auth/login
 * @desc    Login with email and password
 * @access  Public
 * @body    { email: string, password: string }
 * @returns { token: string, user: IUser }
 */
router.post('/login', login);

/**
 * @route   POST /auth/google
 * @desc    Authenticate with Google JWT token
 * @access  Public
 * @body    { token: string }
 * @returns { token: string, user: IUser }
 */
router.post('/google', googleAuth);

export default router;

