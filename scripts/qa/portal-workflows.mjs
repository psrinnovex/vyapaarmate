import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
const root=process.cwd();
const out=process.env.QA_OUTPUT_DIR;
if (!out) throw new Error("Set QA_OUTPUT_DIR to a private scratch directory containing the four portal browser storage files.");
const database=new URL(process.env.DATABASE_URL ?? "");
const base=process.env.QA_BASE_URL ?? "http://localhost:3000";
if (!["localhost","127.0.0.1","[::1]"].includes(database.hostname) || !/audit|test/.test(database.pathname) || !["localhost","127.0.0.1","[::1]"].includes(new URL(base).hostname)) throw new Error("Only local audit/test databases and local apps are allowed.");
const db=new PrismaClient();
const tests=[],cookies={};
const requireTest=await db.business.count({where:{slug:{in:['audit-business','audit-andhra-business']},dataOrigin:'TEST'}});
assert.equal(requireTest,2,'Seed both TEST audit cohorts before running.');
for(const role of ['owner','customer','admin','support']){const state=JSON.parse(fs.readFileSync(out+'/'+role+'-storage.json'));cookies[role]=state.cookies.map(c=>c.name+'='+c.value).join('; ')}
const report=()=>fs.writeFileSync(out+'/integration-report.json',JSON.stringify(tests,null,2));
async function check(name,fn){try{await fn();tests.push({name,status:'pass'});console.log('PASS',name)}catch(e){tests.push({name,status:'fail',error:e.message});console.log('FAIL',name,e.message)}report()}
async function req(role,url,method='GET',body,headers={}){const r=await fetch(base+url,{method,headers:{...(cookies[role]?{Cookie:cookies[role]}:{}),Origin:base,...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(90000)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={text:text.slice(0,1000)}}return {status:r.status,data,headers:r.headers}}
async function login(role,email){const r=await req(null,'/api/auth/login','POST',{email,password:'AuditLocal123!'});assert.equal(r.status,200,JSON.stringify(r.data));cookies[role]=r.headers.get('set-cookie').split(';')[0];}
(async()=>{
 const b=await db.business.findUniqueOrThrow({where:{slug:'audit-business'}}),ap=await db.business.findUniqueOrThrow({where:{slug:'audit-andhra-business'}});
 const item=await db.menuItem.findFirstOrThrow({where:{businessId:b.id}}),apItem=await db.menuItem.findFirstOrThrow({where:{businessId:ap.id}}),ticket=await db.supportTicket.findUniqueOrThrow({where:{code:'AUDIT-SUPPORT-1001'}});
 await check('Owner cannot read admin pilot metrics',async()=>assert.equal((await req('owner','/api/admin/pilot')).status,403));
 await check('Support cannot read platform financial dashboard',async()=>assert.equal((await req('support','/api/admin/live')).status,403));
 await check('Customer cannot read business customer records',async()=>assert.ok([401,403].includes((await req('customer','/api/dashboard/live')).status)));
 await check('Owner cannot edit another tenant catalog',async()=>assert.equal((await req('owner','/api/dashboard/menu/'+apItem.id,'PATCH',{categoryId:item.categoryId,name:'Forbidden',description:'test',price:1,foodType:'VEG',isAvailable:true,isBestSeller:false})).status,404));
 await check('Cross-origin authenticated writes fail closed',async()=>assert.equal((await req('owner','/api/dashboard/menu','POST',{}, {Origin:'https://outside.example','Sec-Fetch-Site':'cross-site'})).status,403));
 for(const [url,method,role] of [['/api/dashboard/menu','POST','owner'],['/api/dashboard/menu/'+item.id,'PATCH','owner'],['/api/dashboard/staff','POST','owner'],['/api/dashboard/orders/missing','PATCH','owner'],['/api/dashboard/payments/missing','PATCH','owner'],['/api/admin/support/'+ticket.id,'PATCH','support']])await check('Malformed JSON returns 400 '+url,async()=>assert.equal((await req(role,url,method,'{broken')).status,400));
 let newItem;
 await check('Owner can create and update a catalog item',async()=>{let r=await req('owner','/api/dashboard/menu','POST',{categoryId:item.categoryId,name:'Pilot Test Meal',description:'Local workflow audit',price:210,foodType:'VEG',isAvailable:true,isBestSeller:false});assert.equal(r.status,201,JSON.stringify(r.data));newItem=r.data.item; r=await req('owner','/api/dashboard/menu/'+newItem.id,'PATCH',{...newItem,price:220});assert.equal(r.status,200,JSON.stringify(r.data));const saved=await db.menuItem.findUniqueOrThrow({where:{id:newItem.id}});assert.equal(saved.dataOrigin,'TEST');assert.equal(saved.trainingEligible,false)});
 const body={businessSlug:b.slug,customer:{name:'Audit Customer',email:'audit.customer@example.test',phone:'+15550100020',whatsappOptIn:false,marketingOptIn:false},orderType:'PICKUP',paymentMethod:'PAY_ON_PICKUP_OR_DELIVERY',notes:'Local audit synthetic order',items:[{menuItemId:item.id,quantity:2}]};let order,payment;
 await check('Customer creates an order using authoritative catalog prices',async()=>{const r=await req('customer','/api/orders','POST',{...body,totalAmount:1});assert.equal(r.status,200,JSON.stringify(r.data));order=await db.order.findUniqueOrThrow({where:{id:r.data.orderId}});assert.equal(Number(order.subtotal),Number(item.price)*2);payment=await db.payment.findUniqueOrThrow({where:{orderId:order.id}});assert.equal(order.dataOrigin,'TEST');assert.equal(order.trainingEligible,false);assert.equal(payment.dataOrigin,'TEST');assert.equal(payment.trainingEligible,false)});
 if(order){
 await check('Order status cannot skip fulfilment steps',async()=>assert.equal((await req('owner','/api/dashboard/orders/'+order.id,'PATCH',{status:'DELIVERED'})).status,409));
 await check('Concurrent duplicate order transitions do not overwrite newer state',async()=>{const responses=await Promise.all([req('owner','/api/dashboard/orders/'+order.id,'PATCH',{status:'ACCEPTED'}),req('owner','/api/dashboard/orders/'+order.id,'PATCH',{status:'ACCEPTED'})]);assert.ok(responses.every(r=>[200,409].includes(r.status)),JSON.stringify(responses.map(r=>r.data)));assert.equal((await db.order.findUniqueOrThrow({where:{id:order.id}})).status,'ACCEPTED')});
 await check('Cash payment updates payment and order together',async()=>{const r=await req('owner','/api/dashboard/payments/'+payment.id,'PATCH',{status:'COMPLETED'});assert.equal(r.status,200,JSON.stringify(r.data));const current=await db.order.findUniqueOrThrow({where:{id:order.id},include:{payment:true}});assert.equal(current.paymentStatus,'COMPLETED');assert.equal(current.payment.status,'COMPLETED')});
 await check('Owner completes the fulfilment chain and records completion time',async()=>{for(const status of ['PREPARING','READY','DELIVERED'])assert.equal((await req('owner','/api/dashboard/orders/'+order.id,'PATCH',{status})).status,200);assert.ok((await db.order.findUniqueOrThrow({where:{id:order.id}})).completedAt)});
 await check('Repeated completion is idempotent',async()=>assert.equal((await req('owner','/api/dashboard/orders/'+order.id,'PATCH',{status:'DELIVERED'})).data.idempotent,true));
 await check('Customer order receipt is available',async()=>assert.equal((await req('customer','/api/orders/'+order.publicToken+'/invoice')).status,200));
 }
 await check('Assigned support agent can update its ticket',async()=>assert.equal((await req('support','/api/admin/support/'+ticket.id,'PATCH',{status:'WAITING_ON_CUSTOMER'})).status,200));
 await check('Pilot enrollment requires recorded consent confirmation',async()=>assert.equal((await req('admin','/api/admin/pilot','PATCH',{businessId:b.id,cohort:'BENGALURU',consentConfirmed:false})).status,400));
 await check('Pilot enrollment rejects a mismatched operating cohort',async()=>assert.equal((await req('admin','/api/admin/pilot','PATCH',{businessId:ap.id,cohort:'BENGALURU',consentConfirmed:true})).status,400));
 await check('Test businesses and payments cannot become pilot traction',async()=>{const r=await req('admin','/api/admin/pilot');assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.excludedFixtures,2);assert.ok(r.data.cohorts.every(c=>c.enrolled===0&&c.paidBusinesses===0&&c.recurringValue===0))});
 await login('kitchen','audit.kitchen@example.test');await login('otherSupport','audit.other.support@example.test');await login('apOwner','audit.andhra.owner@example.test');
 await check('Kitchen staff cannot view customer CRM',async()=>assert.ok([401,403].includes((await req('kitchen','/api/dashboard/live?scope=customers')).status)));
 await check('Kitchen staff cannot change menu prices',async()=>assert.equal((await req('kitchen','/api/dashboard/menu/'+item.id,'PATCH',{})).status,403));
 await check('Unassigned support agent cannot edit another agent ticket',async()=>assert.equal((await req('otherSupport','/api/admin/support/'+ticket.id,'PATCH',{status:'RESOLVED'})).status,403));
 if(order)await check('Other business cannot advance a tenant order',async()=>assert.equal((await req('apOwner','/api/dashboard/orders/'+order.id,'PATCH',{status:'CANCELLED'})).status,404));
 await check('AP subscription preview does not inherit Bengaluru discount',async()=>{const r=await req('apOwner','/api/dashboard/billing/checkout/preview','POST',{plan:'STARTER'});assert.equal(r.status,200,JSON.stringify(r.data));assert.ok(!r.data.promotion,JSON.stringify(r.data));});
 let draftId;
 await check('Campaign drafts are stored and readable after another request',async()=>{const r=await req('owner','/api/dashboard/campaigns','POST',{title:'Local pilot draft',body:'A synthetic campaign preparation check.'});assert.equal(r.status,201,JSON.stringify(r.data));draftId=r.data.draft.id;assert.equal(r.data.deliveryEnabled,false);const list=await req('owner','/api/dashboard/campaigns');assert.ok(list.data.drafts.some(d=>d.id===draftId));});
 if(draftId){
 await check('Other business cannot read or change a campaign draft',async()=>{const list=await req('apOwner','/api/dashboard/campaigns');assert.ok(!list.data.drafts.some(d=>d.id===draftId));assert.equal((await req('apOwner','/api/dashboard/campaigns/'+draftId,'PATCH',{title:'Forbidden',body:'Foreign tenant mutation'})).status,404);assert.equal((await req('apOwner','/api/dashboard/campaigns/'+draftId,'DELETE')).status,404)});
 await check('Owner can edit and delete a persisted draft',async()=>{assert.equal((await req('owner','/api/dashboard/campaigns/'+draftId,'PATCH',{title:'Edited draft',body:'Updated local test draft'})).status,200);assert.equal((await req('owner','/api/dashboard/campaigns/'+draftId,'DELETE')).status,200);assert.ok(!(await req('owner','/api/dashboard/campaigns')).data.drafts.some(d=>d.id===draftId))});
 }
 await check('Kitchen staff cannot access campaign audiences',async()=>assert.equal((await req('kitchen','/api/dashboard/campaigns')).status,403));
 await check('Live business order and customer history resist dashboard deletion',async()=>{assert.equal(b.dataOrigin,'TEST');try{await db.business.update({where:{id:b.id},data:{dataOrigin:'LIVE'}});assert.equal((await req('owner','/api/dashboard/orders/'+order.id,'DELETE')).status,409);assert.equal((await req('owner','/api/dashboard/customers/'+order.customerId,'DELETE')).status,409);assert.ok(await db.order.findUnique({where:{id:order.id}}))}finally{await db.business.update({where:{id:b.id},data:{dataOrigin:'TEST'}})}});
 await check('Logout clears access to protected routes',async()=>{const r=await req('kitchen','/api/auth/logout','POST',{});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);delete cookies.kitchen;assert.ok([401,403].includes((await req('kitchen','/api/dashboard/menu')).status))});
 // Check every protected route/method without a session. Missing IDs must never expose records.
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
 for(const [suffix,method,body]of [['','GET',undefined],['','POST',{body:'Unauthorized local test message'}],['/feedback','POST',{rating:5}]])await check('Support chat requires ownership '+method+suffix,async()=>assert.equal((await req(null,'/api/support/chat/'+ticket.id+suffix,method,body)).status,403));
 const endpoints=walk(root+'/app/api').filter(p=>p.endsWith('/route.ts')&&/\/api\/(admin|dashboard|user)\//.test(p));
 for(const f of endpoints){const source=fs.readFileSync(f,'utf8'),url=f.slice((root+'/app').length).replace('/route.ts','').replace(/\[[^\]]+\]/g,'audit-missing');for(const m of source.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g)){const method=m[1];await check('Anonymous access denied '+method+' '+url,async()=>{const r=await req(null,url,method,method==='GET'?undefined:{});if(url.endsWith('/cashfree')){assert.equal(r.status,307);assert.equal(new URL(r.headers.get('location'),base).pathname,'/login')}else assert.ok([401,403].includes(r.status),r.status+' '+JSON.stringify(r.data).slice(0,250))})}}
process.exitCode=tests.some(t=>t.status==='fail')?1:0;
})().catch(e=>{tests.push({name:'Fatal audit interruption',status:'fail',error:e.stack});report();console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
