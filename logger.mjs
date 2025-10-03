import morgan from 'morgan';

export function attachLogging(app){
  // Log concise line for each request
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
}

export function debugLog(label, payload){
  try{
    console.log(`[DEBUG] ${label}:`, typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
  }catch(e){
    console.log(`[DEBUG] ${label} (unserializable)`);
  }
}
