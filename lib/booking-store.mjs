export const SELECT_RANGE = `SELECT pad, day::text, minute, start_minute, duration, name, booking_id::text
  FROM walkingpad_slots WHERE day BETWEEN $1::date AND $2::date OR day = $3::date ORDER BY day,minute,pad`;
export const SELECT_ID = `SELECT pad, day::text, minute, start_minute, duration, name, booking_id::text FROM walkingpad_slots WHERE booking_id = $1::uuid`;
// One statement: a conflict in either half rolls back the entire hour.
export const INSERT = `INSERT INTO walkingpad_slots (pad,day,minute,booking_id,start_minute,duration,name)
  SELECT $1, $2::date, minute, $3::uuid, $4::integer, $5::integer, $6
  FROM generate_series($4::integer, $4::integer + $5::integer - 30, 30) AS minute
  RETURNING pad, day::text, minute, start_minute, duration, name, booking_id::text`;
export function makeStore(query){
  return {
    list: (from,to,today) => query(SELECT_RANGE,[from,to,today]),
    async book(b){
      const same = rows => rows.length === b.duration/30 && rows.every(r => r.pad===b.pad && r.day===b.iso && r.start_minute===b.start && r.duration===b.duration && r.name===b.name);
      const existing = await query(SELECT_ID,[b.id]);
      if (existing.length){ if(same(existing)) return existing; throw Object.assign(new Error('Request already used'),{code:'23505'}); }
      try {return await query(INSERT,[b.pad,b.iso,b.id,b.start,b.duration,b.name]);}
      catch(e){
        // A lost response or simultaneous retry must not create a second booking.
        if(e.code==='23505'){
          const retry = await query(SELECT_ID,[b.id]);
          if(same(retry)) return retry;
        }
        throw e;
      }
    }
  };
}
export function calendar(rows){
  const pads={SWIFT:{},TEMPO:{},PACER:{}};
  const time = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  for(const r of rows){
    const key = `${r.day}_${time(r.minute)}`;
    pads[r.pad][key] = r.minute===r.start_minute ? {name:r.name,duration:r.duration} : {linked:true,start:`${r.day}_${time(r.start_minute)}`};
  }
  return pads;
}
