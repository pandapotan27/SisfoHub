import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();
export function signToken(user) {
  return jwt.sign({id:user.id, role:user.role, username:user.username}, process.env.JWT_SECRET, {expiresIn:'12h'});
}
export function authRequired(req,res,next) {
  const header=req.headers.authorization || '';
  const token=header.startsWith('Bearer ')?header.slice(7):'';
  if(!token) return res.status(401).json({message:'Silakan login terlebih dahulu.'});
  try { req.user=jwt.verify(token,process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({message:'Sesi login berakhir. Silakan login kembali.'}); }
}
export function roles(...allowed) {
  return (req,res,next)=>allowed.includes(req.user.role)?next():res.status(403).json({message:'Akses tidak diizinkan.'});
}
