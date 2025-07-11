# Security Implementation Guide

## Rate Limiting Protection

This application now includes comprehensive rate limiting to protect against brute force attacks and API abuse.

### Rate Limiting Configuration

#### 1. General API Protection
- **Rate**: 100 requests per 15 minutes per IP
- **Purpose**: Prevents general API abuse and DDoS attacks
- **Applied**: Globally to all endpoints

#### 2. Authentication Protection
- **Login Attempts**: 3 attempts per 15 minutes per IP
- **Registration**: 3 attempts per hour per IP
- **Auth Endpoints**: 5 requests per 15 minutes per IP
- **Purpose**: Prevents brute force attacks on authentication

#### 3. Content Management Protection
- **Blog Actions**: 10 actions per 15 minutes per IP
- **File Uploads**: 20 uploads per 15 minutes per IP
- **Comments**: 15 comments per 15 minutes per IP
- **Admin Actions**: 30 actions per 15 minutes per IP

#### 4. Speed Limiting
- **Threshold**: 50 requests per 15 minutes
- **Delay**: 500ms added per request after threshold
- **Purpose**: Gradual slowdown instead of hard blocking

### Security Headers

The application includes standard security headers:
- Rate limit information in response headers
- Proper error messages without exposing system details

### Error Handling

Rate limit errors return:
```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again later.",
  "retryAfter": 900
}
```

### Monitoring

All rate limit violations are logged through the existing logger system.

## Additional Security Measures

### 1. Authentication
- JWT tokens with 30-day expiration
- Password hashing with bcrypt
- Protected routes with role-based access

### 2. Input Validation
- Request body size limits (10MB)
- Input sanitization and validation
- SQL injection prevention through Mongoose

### 3. CORS Protection
- Whitelisted origins only
- Credentials support for authenticated requests

### 4. File Upload Security
- File type validation
- Size limits
- Cloudinary integration for secure storage

## Testing Rate Limiting

You can test the rate limiting by making multiple rapid requests to any endpoint. For example:

```bash
# Test login rate limiting
for i in {1..5}; do
  curl -X POST http://localhost:5000/api/users/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrongpassword"}'
done
```

## Configuration

Rate limits can be adjusted in `middleware/rateLimit.middleware.js`:

- `windowMs`: Time window for rate limiting
- `max`: Maximum requests allowed in the window
- `delayAfter`: Requests before speed limiting kicks in
- `delayMs`: Delay added per request after threshold

## Best Practices

1. **Monitor Logs**: Regularly check for rate limit violations
2. **Adjust Limits**: Fine-tune based on legitimate usage patterns
3. **Whitelist IPs**: Consider whitelisting trusted IPs if needed
4. **User Feedback**: Provide clear messages when limits are hit
5. **Gradual Escalation**: Use speed limiting before hard blocking

## Emergency Override

In case of emergency, rate limiting can be temporarily disabled by commenting out the middleware in `index.js`:

```javascript
// Comment out these lines to disable rate limiting
// app.use(generalLimiter);
// app.use(speedLimiter);
```

**Note**: Only disable temporarily and re-enable as soon as possible. 