import { Request, Response, NextFunction } from 'express'
import { authService } from './auth.service'
import { sendSuccess } from '../../utils/response'

class AuthController {
  async getNonce(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { walletAddress } = req.body
      const nonce = await authService.getNonce(walletAddress, req.ip, req.headers['user-agent'])
      const message = authService.buildSignMessage(nonce)
      sendSuccess(res, { nonce, message }, 'Nonce generated')
    } catch (error) {
      next(error)
    }
  }

  async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { walletAddress, signature, nonce, referralCode } = req.body
      const result = await authService.verifySignature(
        walletAddress,
        signature,
        nonce,
        req.ip,
        req.headers['user-agent'],
        referralCode,
      )

      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/v1/auth',
      })

      sendSuccess(
        res,
        {
          user: result.user,
          accessToken: result.tokens.accessToken,
          deviceId: result.tokens.deviceId,
          isNewUser: result.isNewUser,
        },
        result.isNewUser ? 'Welcome to Testnet!' : 'Welcome back!',
        result.isNewUser ? 201 : 200,
      )
    } catch (error) {
      next(error)
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken ?? req.body?.refreshToken
      if (!refreshToken) {
        res.status(401).json({ success: false, message: 'Refresh token required' })
        return
      }
      const tokens = await authService.refreshTokens(refreshToken, req.ip, req.headers['user-agent'])

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/v1/auth',
      })

      sendSuccess(res, { accessToken: tokens.accessToken, deviceId: tokens.deviceId }, 'Token refreshed')
    } catch (error) {
      next(error)
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken ?? req.body?.refreshToken
      if (refreshToken) {
        await authService.revokeToken(refreshToken)
      }
      res.clearCookie('refreshToken', { path: '/api/v1/auth' })
      sendSuccess(res, null, 'Logged out successfully')
    } catch (error) {
      next(error)
    }
  }

  async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.revokeAllUserTokens(req.user!.id)
      res.clearCookie('refreshToken', { path: '/api/v1/auth' })
      sendSuccess(res, null, 'All sessions revoked')
    } catch (error) {
      next(error)
    }
  }
}

export const authController = new AuthController()
