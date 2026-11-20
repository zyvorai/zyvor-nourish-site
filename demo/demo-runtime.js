/* Synthetic browser demo only. This is not server authentication or secure storage. */
(()=>{
 const KEY='zyvora-nourish-demo-v2',SESSION='zyvora-nourish-demo-session';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const makeId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
 const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 function read(){const raw=localStorage.getItem(KEY);if(raw){try{return JSON.parse(raw);}catch{}}const s=clone(window.NOURISH_SEED);s.audit=[];s._keys={};s._epoch=0;localStorage.setItem(KEY,JSON.stringify(s));return s;}
 function save(s){localStorage.setItem(KEY,JSON.stringify(s));}
 function user(s){let u;try{u=JSON.parse(sessionStorage.getItem(SESSION));}catch{}if(!u||u.epoch!==s._epoch)throw Error('Sign in to the synthetic demonstration.');return u;}
 const required=(d,keys)=>{for(const k of keys)if(d[k]===undefined||d[k]===null||d[k]==='')throw Error('Required field: '+k);};
 const numeric=(x,min,max)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)throw Error('Invalid numeric value');};
 function analyse(s){const cutoff=new Date(Date.parse(day())-30*86400000).toISOString().slice(0,10),end=new Date(Date.parse(day())+14*86400000).toISOString().slice(0,10);const seen=new Map(),duplicates=[],stale=[];
 for(const p of s.people){const key=p.name.toLowerCase().trim().replace(/\s+/g,' ')+'|'+p.dob;if(seen.has(key))duplicates.push({person_id:p.id,possible_match:seen.get(key),reason:'Same normalized name and date of birth; review manually.'});seen.set(key,p.id);const ms=s.measurements.filter(m=>m.person_id===p.id).map(m=>m.date).sort();if(p.category==='child'&&(!ms.length||ms.at(-1)<cutoff))stale.push({person_id:p.id,last_measurement:ms.at(-1)||null});}
 const stats={people:s.people.length,overdue_visits:s.visits.filter(v=>v.status==='planned'&&v.date<day()).length,open_referrals:s.referrals.filter(r=>r.status!=='closed').length,appointments_today:s.appointments.filter(a=>a.status==='scheduled'&&a.date===day()).length,open_tasks:s.tasks.filter(t=>t.status!=='done').length,deliveries_last_30_days:s.deliveries.filter(d=>d.date>=cutoff&&d.date<=day()).length,measurement_followups:stale.length,possible_duplicates:duplicates.length,expiring_batches:s.batches.filter(b=>b.quantity>0&&b.expiry<=end).length};
 const groups=new Map();for(const b of s.batches){const key=[b.item,b.unit,b.centre].join('|');if(!groups.has(key))groups.set(key,{item:b.item,unit:b.unit,centre:b.centre,available:0,consumption:0});const f=groups.get(key);if(b.expiry>=day())f.available+=b.quantity;f.consumption+=s.deliveries.filter(d=>d.batch_id===b.id&&d.date>=cutoff&&d.date<=day()).reduce((a,d)=>a+d.quantity,0);}
 return {stats,provider_available:false,mode:'rules',quality:{possible_duplicates:duplicates,measurement_followups:stale},forecast:[...groups.values()].map(f=>({...f,available:+f.available.toFixed(2),daily_use:+(f.consumption/30).toFixed(3),days_remaining:f.consumption?+(f.available/(f.consumption/30)).toFixed(1):null})),signals:[{title:'Review overdue visits',count:stats.overdue_visits,page:'Care',reason:'Planned date is before today.'},{title:'Close the referral loop',count:stats.open_referrals,page:'Care',reason:'Referral has not been closed.'},{title:'Review measurement follow-ups',count:stale.length,page:'Growth',reason:'No recorded measurement in 30 days; administrative reminder only.'},{title:'Review expiring stock',count:stats.expiring_batches,page:'Nutrition',reason:'Nonzero stock expires within 14 days or is expired.'}]};}
 window.demoApi=async(path,method='GET',data,key)=>{
 let s=read();if(path==='config')return {demo:true,browser_demo:true,version:'0.2.0'};
 if(path==='demo-session'||path==='login'){
  const role=path==='login'?(data.email.startsWith('worker@')?'worker':data.email.startsWith('viewer@')?'viewer':'admin'):'admin';
  if(path==='login'&&(!['admin@nourish.local','worker@nourish.local','viewer@nourish.local'].includes(data.email)||data.password!=='Nourish-demo-2026!'))throw Error('Use the displayed synthetic demo credentials.');
  sessionStorage.setItem(SESSION,JSON.stringify({name:role==='admin'?'Programme lead':role==='worker'?'Field worker':'Programme viewer',email:role+'@nourish.local',role,epoch:s._epoch}));return {ok:true};
 }
 const u=user(s);
 if(path==='logout'||path==='revoke-sessions'){if(path==='revoke-sessions'){s._epoch++;save(s);}sessionStorage.removeItem(SESSION);return {ok:true};}
 if(path==='state'){const result=clone(s);delete result._keys;delete result._epoch;return {...result,user:u,demo:true,audit:u.role==='admin'?s.audit:[]};}
 if(path==='intelligence')return analyse(s);
 if(path==='assistant')throw Error('Connect a provider on your server to enable AI-generated briefings. This browser demo uses local rules only.');
 if(path==='change-password')throw Error('Password changes are disabled for shared demonstration accounts.');
 if(u.role==='viewer')throw Error('Read-only account');
 const [kind,id]=path.split('/');if(!Array.isArray(s[kind])||kind==='audit')throw Error('Unknown resource');
 if(['batches','menus','adjustments'].includes(kind)&&u.role!=='admin')throw Error('Administrator access required');
 const fingerprint=JSON.stringify([path,data]);if(method==='POST'&&s._keys[key]){if(s._keys[key].fingerprint!==fingerprint)throw Error('Request key reused with different data');return clone(s._keys[key].result);}
 const old=id?s[kind].find(x=>x.id===id):null;
 if(method==='PATCH'&&(!old||old.version!==data.version))throw Error('Record changed. Refresh before saving.');
 if(method==='PATCH'&&!['visits','referrals','appointments','attendance','tasks','menus','equipment'].includes(kind))throw Error('This record is immutable');
 const d={...(old||{}),...data};
 if(d.date&&!/^\d{4}-\d{2}-\d{2}$/.test(d.date))throw Error('Invalid date');
 if(['measurements','attendance','deliveries','immunizations','counselling'].includes(kind)&&d.date>day())throw Error('Cannot record a future event');
 const p=d.person_id?s.people.find(p=>p.id===d.person_id):null;
 if(['measurements','visits','referrals','appointments','attendance','deliveries','immunizations','counselling'].includes(kind)){if(!p)throw Error('Person not found');required(d,['date']);if(d.date<p.dob)throw Error('Date precedes birth');}
 if(kind==='people'){required(d,['name','dob','centre','category','sex']);if(d.consent!==true)throw Error('Recorded consent is required');if(d.dob>day()||d.dob<'1900-01-01')throw Error('Invalid date of birth');d.consent_date=day();}
 if(kind==='measurements'){numeric(d.weight_kg,.3,300);numeric(d.height_cm,20,240);required(d,['position']);}
 if(kind==='visits'){required(d,['purpose','status']);if(d.status==='completed'&&d.date>day())throw Error('Cannot complete a future visit');}
 if(kind==='referrals'){required(d,['destination','reason','priority','status']);if(d.status==='closed'&&!d.outcome?.trim())throw Error('Closing a referral requires an outcome');}
 if(kind==='appointments'){required(d,['facility','purpose','time','status']);if(d.status==='attended'&&d.date>day())throw Error('Cannot complete a future appointment');}
 if(kind==='attendance'){if(old&&(old.person_id!==d.person_id||old.date!==d.date))throw Error('Attendance identity is immutable');if(s.attendance.some(a=>a.id!==id&&a.person_id===d.person_id&&a.date===d.date))throw Error('Attendance already recorded for this date');d.centre=p.centre;}
 if(kind==='immunizations')required(d,['vaccine','dose','batch_code','facility']);
 if(kind==='counselling')required(d,['topic','facilitator']);
 if(kind==='equipment')required(d,['title','centre','serial','date','status']);
 if(kind==='tasks')required(d,['title','assignee','centre','status','priority','date']);
 if(kind==='menus'){required(d,['title','centre','meal','ingredients','status']);numeric(d.portions,1,100000);if(!Number.isInteger(d.portions))throw Error('Portions must be a whole number');}
 if(kind==='batches'){required(d,['item','batch_code','expiry','centre','unit']);numeric(d.quantity,1,1000000);if(d.expiry<day())throw Error('Cannot receive expired stock');}
 if(['deliveries','adjustments'].includes(kind)){
  const batch=s.batches.find(b=>b.id===d.batch_id);if(!batch)throw Error('Batch not found');let delta;
  if(kind==='deliveries'){numeric(d.quantity,.01,1000000);delta=-d.quantity;if(batch.expiry<day())throw Error('Batch has expired');if(batch.centre!==p.centre)throw Error('Stock and person must belong to the same centre');d.item=batch.item;d.unit=batch.unit;}
  else{numeric(d.delta,-1000000,1000000);if(!d.delta)throw Error('Adjustment cannot be zero');required(d,['reason']);delta=d.delta;d.date=day();d.item=batch.item;d.unit=batch.unit;if(delta>0&&batch.expiry<day())throw Error('Cannot add expired stock');}
  if(batch.quantity+delta<0)throw Error('Insufficient stock');batch.quantity=+(batch.quantity+delta).toFixed(4);batch.version++;
 }
 d.id=old?.id||makeId();d.version=(old?.version||0)+1;d.created=old?.created||new Date().toISOString();if(old)s[kind][s[kind].indexOf(old)]=d;else s[kind].push(d);
 s.audit.unshift({action:(old?'update:':'create:')+kind,record_id:d.id,at:new Date().toISOString()});s.audit=s.audit.slice(0,30);if(method==='POST')s._keys[key]={fingerprint,result:d};save(s);return clone(d);
 };
 document.addEventListener('click',e=>{
 const a=e.target.closest('a[href="./api/report.csv"],a[href="./api/export.json"]');if(!a)return;e.preventDefault();try{const s=read(),u=user(s);if(u.role!=='admin')throw Error('Administrator access required');const json=a.getAttribute('href').endsWith('json');const keys=Object.keys(window.NOURISH_SEED).filter(k=>Array.isArray(s[k]));const body=json?JSON.stringify({schema_version:2,demo:true,records:keys.flatMap(k=>s[k].map(r=>({...r,kind:k})))},null,2):'resource,count\n'+keys.map(k=>k+','+s[k].length).join('\n');const url=URL.createObjectURL(new Blob([body],{type:json?'application/json':'text/csv'}));const link=document.createElement('a');link.href=url;link.download=json?'nourish-demo-export.json':'nourish-demo-summary.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}catch(err){alert(err.message);}
 });
 window.resetNourishDemo=()=>{localStorage.removeItem(KEY);sessionStorage.removeItem(SESSION);location.reload();};
})();
