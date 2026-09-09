import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const root=process.cwd(),out=process.env.QA_OUTPUT_DIR,base=process.env.QA_BASE_URL ?? "http://localhost:3000";
if (!out || !["localhost","127.0.0.1","[::1]"].includes(new URL(base).hostname)) throw new Error("Use a local QA_BASE_URL and a private QA_OUTPUT_DIR for browser cookies and screenshots.");
const fixtures=JSON.parse(fs.readFileSync(out+'/fixtures.json'));
fs.mkdirSync(out+'/screens',{recursive:true});fs.mkdirSync(out+'/page-text',{recursive:true});
const roles={owner:{email:'audit.owner@example.test',portal:'business',home:'/dashboard'},customer:{email:'audit.customer@example.test',portal:'user',home:'/user'},admin:{email:'audit.admin@example.test',portal:'admin',home:'/admin'},support:{email:'audit.support@example.test',portal:'support',home:'/support'}};
const report={startedAt:new Date().toISOString(),logins:[],pages:[]};
function save(){fs.writeFileSync(out+'/browser-report.json',JSON.stringify(report,null,2))}
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)])}
const routes=files(root+'/app').filter(p=>p.endsWith('/page.tsx')).map(p=>p.slice((root+'/app').length).replace('/page.tsx','')||'/').map(p=>p.replace('[slug]','audit-business').replace('[publicToken]',fixtures.order.publicToken).replace('[subscriptionId]',fixtures.subscription));
const group=p=>p.startsWith('/admin')?'admin':p.startsWith('/dashboard')?'owner':p.startsWith('/support')?'support':p.startsWith('/user')||p==='/businesses'||p.startsWith('/b/')?'customer':'public';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const contexts={};try{
 contexts.public=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block',geolocation:{latitude:12.9716,longitude:77.5946},permissions:['geolocation']});
 for(const [role,account]of Object.entries(roles)){
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block',geolocation:{latitude:12.9716,longitude:77.5946},permissions:['geolocation']});contexts[role]=context;
  const page=await context.newPage();page.setDefaultTimeout(90000);
  await page.goto(base+'/login?type='+account.portal,{waitUntil:'domcontentloaded',timeout:90000});
  await page.getByLabel('Email',{exact:true}).fill(account.email);await page.getByLabel('Password',{exact:true}).fill('AuditLocal123!');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL(url=>url.pathname===account.home,{timeout:90000});
  const session=await context.request.get(base+'/api/auth/session');const data=await session.json();
  report.logins.push({role,path:new URL(page.url()).pathname,sessionRole:data.user?.role,status:session.status()});save();
  await context.storageState({path:out+'/'+role+'-storage.json'});await page.close();console.log('LOGIN',role,data.user?.role);
 }
 for(const route of routes){
  const role=group(route),context=contexts[role],page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  page.setDefaultTimeout(60000);let status=0;
  try{
   const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:90000});status=response?.status()??0;
   // Live dashboards fetch their content after the server shell. Wait for a meaningful heading.
   await page.locator('h1').first().waitFor({state:'visible',timeout:75000}).catch(()=>{});
   await page.waitForFunction(()=>document.querySelectorAll('main .animate-pulse').length===0,{},{timeout:30000}).catch(()=>pageErrors.push('Loading placeholders remained after 30 seconds'));await page.waitForTimeout(1500);
   const name=route.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'home';
   for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:width<500?844:900});await page.waitForTimeout(200);
    const info=await page.evaluate(()=>({title:document.title,h1:[...document.querySelectorAll('h1')].map(e=>e.textContent),width:innerWidth,scrollWidth:document.documentElement.scrollWidth,brokenImages:[...document.images].filter(e=>e.complete&&e.naturalWidth===0&&e.currentSrc).map(e=>e.currentSrc),bodyText:document.body.innerText,linkCount:document.querySelectorAll('a[href]').length}));
    const text=info.bodyText;delete info.bodyText;
    fs.writeFileSync(out+'/page-text/'+name+'.txt',text);if(width===390)await page.screenshot({path:out+'/screens/'+name+'-'+width+'-full.png',fullPage:true,timeout:20000,animations:'disabled'});
    await page.screenshot({path:out+'/screens/'+name+'-'+width+'.png',timeout:20000,animations:'disabled'}).catch(e=>pageErrors.push('Screenshot: '+e.message.slice(0,120)));
    report.pages.push({route,role,status,finalPath:new URL(page.url()).pathname,width,...info,errors:[...pageErrors],applicationError:/Application error:|Internal Server Error|Something went wrong|Unable to load/i.test(text),loadingOnly:!info.h1.length&&/dashboard|admin|support|user/.test(role),screenshot:'screens/'+name+'-'+width+'.png'});save();
   }
   console.log('PAGE',route,status,new URL(page.url()).pathname);
  }catch(e){report.pages.push({route,role,status,error:e.message});save();console.log('FAIL',route,e.message.slice(0,120));}
  await page.close();
 }
 report.finishedAt=new Date().toISOString();save();
}finally{await browser.close()}})().catch(e=>{report.fatal=e.stack;save();console.error(e);process.exit(1)});
