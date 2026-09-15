import {createHmac,timingSafeEqual} from 'node:crypto';
import {calendar} from './booking-store.mjs';
const COOKIE='sleepwalker_session';
const WEEK=7*24*60*60;
const signature=(v,secret)=>createHmac('sha256',secret).update(v).digest('hex');
const equal=(a,b)=>{const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length && timingSafeEqual(aa,bb);};
export const dubaiDay = now => new Date(now.getTime()+4*60*60*1000).toISOString().slice(0,10);
export function validDate(s){return typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;}
export function createHandler({store,password,now=()=>new Date()}){
  const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
  return async request=>{
    if(!password) return json({error:'Shared booking service is not configured yet.'},503);
    const url=new URL(request.url);
    const stamp=now();
    const token=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
    const [expires,sig]=token.split('.');
    const authenticated = /^\d+$/.test(expires||'') && Number(expires)>stamp.getTime()/1000 && equal(sig||'',signature(expires,password));
    if(request.method==='POST'){
      const origin=request.headers.get('origin');
      if(origin && origin!==url.origin) return json({error:'Request origin is not allowed.'},403);
      if(!request.headers.get('content-type')?.includes('application/json')) return json({error:'JSON is required.'},415);
    }
    try {
      if(request.method==='POST'){
        const text=await request.text();
        if(text.length>2048) return json({error:'Request too large.'},413);
        let body;try{body=JSON.parse(text);}catch{return json({error:'Invalid request.'},400);}
        if(!body || typeof body!=='object') return json({error:'Invalid request.'},400);
        if(body.action==='login'){
          if(typeof body.password!=='string' || !equal(body.password,password)) return json({error:'Wrong password. Try again.'},401);
          const expiry=String(Math.floor(stamp.getTime()/1000)+WEEK);
          return json({ok:true},200,{'Set-Cookie':`${COOKIE}=${expiry}.${signature(expiry,password)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${WEEK}${url.protocol==='https:'?'; Secure':''}`});
        }
        if(!authenticated) return json({error:'Please unlock the calendar again.'},401);
        const {pad,iso,time,duration,id}=body;
        const name=typeof body.name==='string'?body.name.trim().toUpperCase():'';
        if(pad!=='SWIFT' || !validDate(iso) || !/^(09|1[0-7]):(00|30)$/.test(time||'') || ![30,60].includes(duration) || !name || name.length>60 || typeof id!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return json({error:'Check the pad, date, time, duration and name.'},400);
        const start=Number(time.slice(0,2))*60+Number(time.slice(3));
        const weekday=new Date(iso+'T12:00:00+04:00').getUTCDay();
        if(weekday===0||weekday===6||start+duration>1080) return json({error:'Choose a weekday slot between 09:00 and 18:00 Dubai time.'},400);
        if(new Date(`${iso}T${time}:00+04:00`)<=stamp) return json({error:'This slot has already started. Pick a later time.'},409);
        try {const rows=await store.book({pad,iso,start,duration,name,id});return json({pads:calendar(rows)},201);}
        catch(e){if(e.code==='23505')return json({error:'That time was just booked. Choose another slot.'},409);throw e;}
      }
      if(request.method!=='GET')return json({error:'Method not allowed.'},405,{'Allow':'GET, POST'});
      if(!authenticated)return json({error:'Please unlock the calendar.'},401);
      if(url.searchParams.get('action')==='session')return json({ok:true});
      const from=url.searchParams.get('from'),to=url.searchParams.get('to');
      if(!validDate(from)||!validDate(to)||to<from||Date.parse(to)-Date.parse(from)>7*86400000)return json({error:'Invalid calendar range.'},400);
      return json({pads:calendar(await store.list(from,to,dubaiDay(stamp))),timeZone:'Asia/Dubai'});
    }catch(e){console.error('Booking service failed:',e.code||e.name);return json({error:'Shared storage is unavailable. Please try again. No local booking has been saved.'},503);}
  };
}
