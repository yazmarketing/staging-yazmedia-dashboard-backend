import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface GoogleUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  googleId: string;
  picture?: string;
}

/**
 * Verify Google ID token and extract user information
 * @param token - Google ID token from frontend
 * @returns User information extracted from the token
 * @throws Error if token is invalid or verification fails
 */
export async function verifyGoogleToken(token: string): Promise<GoogleUserPayload> {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error('GOOGLE_CLIENT_ID environment variable is not set');
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Failed to extract payload from Google token');
    }

    return {
      email: payload.email || '',
      firstName: payload.given_name || '',
      lastName: payload.family_name || '',
      googleId: payload.sub || '',
      picture: payload.picture,
    };
  } catch (error) {
    console.error('❌ Google token verification error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw new Error(`Invalid Google token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

