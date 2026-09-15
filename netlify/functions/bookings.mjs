import {getDatabase} from '@netlify/database';
import {makeStore} from '../../lib/booking-store.mjs';
import {createHandler} from '../../lib/booking-api.mjs';
const store=makeStore((query,params)=>getDatabase().sql.unsafe(query,params));
export default request=>createHandler({store,password:process.env.TEAM_PASSWORD})(request);
