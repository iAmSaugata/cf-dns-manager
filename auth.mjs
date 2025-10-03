import cookieParser from 'cookie-parser';

export function attachCookieParser(app){
  app.use(cookieParser());
}

export function passwordMiddleware(req, res, next){
  const headerPass = req.header('x-app-password');
  const cookiePass = req.cookies?.app_password;
  const pass = headerPass || cookiePass;
  const expected = process.env.APP_PASSWORD;
  if(!expected){
    return res.status(500).json({error: 'Server is not configured: APP_PASSWORD missing.'});
  }
  if(pass !== expected){
    return res.status(401).json({error: 'Unauthorized'});
  }
  next();
}
