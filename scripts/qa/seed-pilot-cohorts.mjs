import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const out=process.env.QA_OUTPUT_DIR;
const database=new URL(process.env.DATABASE_URL ?? "");
if (!out || !["localhost","127.0.0.1","[::1]"].includes(database.hostname) || !/audit|test/.test(database.pathname)) throw new Error("Use a local audit/test database and QA_OUTPUT_DIR.");
fs.mkdirSync(out,{recursive:true,mode:0o700});
const prisma=new PrismaClient();
(async()=>{
 const owner=await prisma.user.findUniqueOrThrow({where:{email:'audit.owner@example.test'}});
 const b=await prisma.business.findUniqueOrThrow({where:{id:owner.businessId}});
 const copy={...b};delete copy.id;delete copy.createdAt;delete copy.updatedAt;
 if(b.dataOrigin!=='TEST')throw new Error('Expected the responsive audit TEST business.');
 const ap=await prisma.business.upsert({where:{slug:'audit-andhra-business'},update:{dataOrigin:'TEST',pilotCohort:'ANDHRA_PRADESH',pilotEnrolledAt:new Date()},create:{...copy,slug:'audit-andhra-business',name:'Audit Andhra Food',email:'audit.andhra.business@example.test',phone:'+15550100030',city:'Tirupati',state:'Andhra Pradesh',latitude:13.6288,longitude:79.4192,pilotCohort:'ANDHRA_PRADESH'}});
 for(const [email,phone,role,businessId] of [
 ['audit.andhra.owner@example.test','+15550100031','OWNER',ap.id],['audit.manager@example.test','+15550100032','MANAGER',b.id],['audit.kitchen@example.test','+15550100033','KITCHEN_STAFF',b.id],['audit.other.customer@example.test','+15550100034','CUSTOMER',null],['audit.other.support@example.test','+15550100035','SUPPORT_AGENT',null]]){
 const data={name:'Local '+role,email,phone,role,businessId,passwordHash:owner.passwordHash,emailVerifiedAt:new Date(),phoneVerifiedAt:new Date()};await prisma.user.upsert({where:{email},update:data,create:data});
 }
 await prisma.business.updateMany({where:{id:{in:[b.id,ap.id]}},data:{businessHours:'00:00 - 23:59',isOpen:true}});
 const source=await prisma.subscription.findFirstOrThrow({where:{businessId:b.id}});const sub={...source};delete sub.id;delete sub.createdAt;
 if(!await prisma.subscription.findFirst({where:{businessId:ap.id}})) await prisma.subscription.create({data:{...sub,businessId:ap.id}});
 const category=await prisma.menuCategory.upsert({where:{businessId_name:{businessId:ap.id,name:'Andhra Test Menu'}},update:{},create:{businessId:ap.id,name:'Andhra Test Menu',dataOrigin:'TEST',trainingEligible:false}});
 if(!await prisma.menuItem.findFirst({where:{businessId:ap.id}})) await prisma.menuItem.create({data:{businessId:ap.id,categoryId:category.id,name:'Andhra Test Meal',description:'Synthetic local food item',price:140,foodType:'VEG',isAvailable:true,dataOrigin:'TEST',trainingEligible:false}});
 const all={business:b.id,andhraBusiness:ap.id,subscription:source.id,order:await prisma.order.findFirst({where:{businessId:b.id},select:{id:true,publicToken:true}})};
 fs.writeFileSync(out+'/fixtures.json',JSON.stringify(all));console.log('Local cross-role and cross-tenant fixtures ready.');
})().finally(()=>prisma.$disconnect());
