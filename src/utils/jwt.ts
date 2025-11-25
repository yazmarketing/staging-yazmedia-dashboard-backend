import jwt, { SignOptions } from 'jsonwebtoken';
import { StringValue } from 'ms';
import { IJWTPayload } from '../types';

const JWT_SECRET: string = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRY: StringValue = (process.env.JWT_EXPIRY || '7d') as StringValue;

export const generateToken = (payload: Omit<IJWTPayload, 'iat' | 'exp'>): string => {
  const options: SignOptions = { expiresIn: JWT_EXPIRY };
  return jwt.sign(payload as object, JWT_SECRET, options);
};

export const verifyToken = (token: string): IJWTPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as IJWTPayload;
  } catch (error) {
    return null;
  }
};

export const decodeToken = (token: string): IJWTPayload | null => {
  try {
    return jwt.decode(token) as IJWTPayload;
  } catch (error) {
    return null;
  }
};

