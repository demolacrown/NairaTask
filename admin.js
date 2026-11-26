const CONFIG={url:"https://qezdxvyndsudckmreqlk.supabase.co",key:"sb_publishable_YpR1Ru2j1QpkcPggrw1fMQ_ZB2df16w"};
const db=window.supabase.createClient(CONFIG.url,CONFIG.key);
const $=id=>document.getElementById(id);
function toast(s){$("toast").textContent=s;$("toast").classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>$("toast").classList.remove("show"),2600)}
async function invoke(body){const {data,error}=await db.functions.invoke("admin-management",{body});if(error)throw new Error(data?.error||error.message);if(data?.error)throw new Error(data.error);return data}
function clearForm(){$("taskForm").reset();$("taskId").value="";$("reward").value="20";$("status").value="draft";$("formTitle").textContent="Create a task";$("saveButton").textContent="Save task";$("formMessage").textContent=""}
function editTask(t){$("taskId").value=t.id;$("title").value=t.title;$("description").value=t.description;$("category").value=t.category;$("reward").value=(Number(t.reward_kobo)/100).toFixed(2);$("destination").value=t.destination_url||"";$("proofType").value=t.proof_type;$("status").value=t.status;$("proofInstructions").value=t.proof_instructions||"";$("dailyLimit").value=t.daily_limit||"";$("totalLimit").value=t.total_limit||"";$("formTitle").textContent="Edit task";$("saveButton").textContent="Update task";window.scrollTo({top:0,behavior:"smooth"})}
async function loadTasks(){const data=await invoke({action:"list_tasks"});const tasks=data.tasks||[];$("allCount").textContent=tasks.length;$("liveCount").textContent=tasks.filter(t=>t.status==="published").length;$("draftCount").textContent=tasks.filter(t=>t.status==="draft").length;const root=$("taskRows");root.replaceChildren();if(!tasks.length){const p=document.createElement("p");p.className="muted";p.textContent="No tasks yet. Create your first task above.";root.append(p);return}for(const t of tasks){const row=document.createElement("div");row.className="task-row";const main=document.createElement("div");main.className="task-main";const title=document.createElement("b");title.textContent=t.title;const meta=document.createElement("small");meta.textContent=t.category+" · ₦"+(Number(t.reward_kobo)/100).toFixed(2);main.append(title,meta);const state=document.createElement("span");state.className="pill "+t.status;state.textContent=t.status;const actions=document.createElement("div");actions.className="row-actions";const edit=document.createElement("button");edit.textContent="Edit";edit.addEventListener("click",()=>editTask(t));const toggle=document.createElement("button");toggle.textContent=t.status==="published"?"Pause":t.status==="paused"?"Publish":"Publish";toggle.addEventListener("click",async()=>{try{await invoke({action:"update_task",id:t.id,task:{status:t.status==="published"?"paused":"published"}});toast("Task status updated.");await loadTasks();await loadBankDetails();await loadWithdrawals()}catch(e){toast(e.message)}});actions.append(edit,toggle);row.append(main,state,actions);root.append(row)}}
async function loadBankDetails(){
 const data=await invoke({action:"list_bank_details"});
 const rows=data.bank_details||[];
 const root=$("bankDetailRows");root.replaceChildren();
 if(!rows.length){const p=document.createElement("p");p.className="muted";p.textContent="No bank details have been submitted yet.";root.append(p);return;}
 for(const item of rows){
  const row=document.createElement("article");row.className="task-row";
  const main=document.createElement("div");main.className="task-main";
  const title=document.createElement("b");title.textContent=item.profile?.display_name||item.profile?.username||"NairaTask user";
  const meta=document.createElement("small");meta.textContent=(item.profile?.username?"@"+item.profile.username+" · ":"")+ "Telegram ID: "+(item.profile?.telegram_id||"—");
  const bank=document.createElement("small");bank.textContent=item.bank_name+" · "+item.account_name+" · "+item.account_number;
  const status=document.createElement("small");status.textContent="Status: "+item.review_status+" · Submitted: "+new Date(item.submitted_at).toLocaleString();
  main.append(title,meta,bank,status);row.append(main);
  if(item.review_status!=="reviewed"){
   const review=document.createElement("button");review.className="ghost";review.textContent="Mark reviewed";
   review.addEventListener("click",async()=>{review.disabled=true;try{await invoke({action:"mark_bank_details_reviewed",user_id:item.user_id});toast("Bank details marked as reviewed.");await loadBankDetails();}catch(e){toast(e.message);review.disabled=false;}});
   row.append(review);
  }
  root.append(row);
 }
}

async function loadWithdrawals(){
 const data=await invoke({action:"list_withdrawals"});
 const rows=data.withdrawals||[];
 const root=$("withdrawalRows");root.replaceChildren();
 if(!rows.length){const p=document.createElement("p");p.className="muted";p.textContent="No withdrawal requests yet.";root.append(p);return;}
 for(const item of rows){
  const row=document.createElement("article");row.className="task-row";
  const main=document.createElement("div");main.className="task-main";
  const title=document.createElement("b");title.textContent=(item.profile?.display_name||item.profile?.username||"NairaTask user")+" · ₦"+(Number(item.amount_kobo)/100).toLocaleString("en-NG",{minimumFractionDigits:2});
  const meta=document.createElement("small");meta.textContent=(item.source==="tasks"?"Task earnings":"Referral earnings")+" · "+(item.profile?.username?"@"+item.profile.username+" · ":"")+"Status: "+item.status+" · "+new Date(item.requested_at).toLocaleString();
  const bank=item.bank_details||{};
  const account=document.createElement("small");account.textContent=(bank.bank_name||item.bank_name||"Bank not set")+" · "+(bank.account_name||item.account_name||"")+" · "+(bank.account_number||("****"+(item.account_number_last4||"")));
  main.append(title,meta,account);row.append(main);
  if(["pending","approved","processing"].includes(item.status)){
   const actions=document.createElement("div");actions.className="row-actions";
   const paid=document.createElement("button");paid.textContent="Mark paid";
   paid.addEventListener("click",async()=>{if(!window.confirm("Confirm you have manually transferred this withdrawal?"))return;paid.disabled=true;try{await invoke({action:"update_withdrawal_status",id:item.id,status:"paid"});toast("Withdrawal marked paid.");await loadWithdrawals();}catch(e){toast(e.message);paid.disabled=false;}});
   const reject=document.createElement("button");reject.textContent="Reject";
   reject.addEventListener("click",async()=>{if(!window.confirm("Reject this withdrawal request?"))return;reject.disabled=true;try{await invoke({action:"update_withdrawal_status",id:item.id,status:"rejected"});toast("Withdrawal rejected; balance released.");await loadWithdrawals();}catch(e){toast(e.message);reject.disabled=false;}});
   actions.append(paid,reject);row.append(actions);
  }
  root.append(row);
 }
}

function clearAdCampaignForm(){
 $("adCampaignForm").reset(); $("adCampaignId").value=""; $("adTitle").value="";
 $("adReward").value="50"; $("adDailyLimit").value="5";
 $("adDailyBudget").value="0"; $("adTotalBudget").value="0"; $("adStatus").value="draft";
 $("adFormMessage").textContent=""; $("saveAdCampaign").textContent="Save campaign";
 updateAdRewardLabel();
}
function updateAdRewardLabel(){
 const daily=$("adCampaignType").value==="daily_reward";
 $("adRewardLabel").firstChild.textContent=daily?"Reward paid by existing daily check-in (₦)":"Reward per completed ad (₦)";
 $("adReward").disabled=daily;
 if(daily){$("adReward").value="0";$("adDailyLimit").value="1";$("adDailyLimit").disabled=true;} else {$("adDailyLimit").disabled=false;if(Number($("adReward").value)===0)$("adReward").value="50";if(Number($("adDailyLimit").value)===1)$("adDailyLimit").value="5";}
}
function editAdCampaign(c){
 $("adCampaignId").value=c.id; $("adTitle").value=c.title; $("adDescription").value=c.description||"";
 $("adCampaignType").value=c.campaign_type;
 $("adReward").value=(Number(c.reward_kobo||0)/100).toString(); $("adDailyLimit").value=c.daily_limit;
 $("adDailyBudget").value=(Number(c.daily_budget_kobo||0)/100).toString();
 $("adTotalBudget").value=(Number(c.total_budget_kobo||0)/100).toString();
 $("adStatus").value=c.status;
 $("adFormMessage").textContent="Active publishing is locked until provider verification is connected.";
 $("saveAdCampaign").textContent="Update campaign"; updateAdRewardLabel();
 window.scrollTo({top:0,behavior:"smooth"});
}
async function loadAdCampaigns(){
 const data=await invoke({action:"list_ad_campaigns"});
 const provider=data.provider||{};
 const status=$("providerStatus");
 status.textContent=provider.connection_status==="connected"?"Monetag connected":provider.connection_status==="pending"?"Monetag setup pending":"Monetag not connected";
 status.className="pill "+(provider.connection_status==="connected"?"published":"");
 $("monetagPublisherRef").value=provider.publisher_reference||"";
 $("monetagZoneId").value=provider.sdk_zone_id||"";
 $("monetagScriptUrl").value=provider.sdk_script_url||"";
 $("monetagSetupStatus").textContent=provider.connection_status||"not_connected";
 $("monetagSetupStatus").className="pill "+(provider.connection_status==="connected"?"published":"");
 $("activateMonetag").disabled=!(provider.sdk_zone_id&&provider.sdk_script_url)||provider.connection_status==="connected";
 const rows=data.campaigns||[]; const root=$("adCampaignRows"); root.replaceChildren();
 if(!rows.length){const p=document.createElement("p");p.className="muted";p.textContent="No ad campaigns yet. Create your first campaign above.";root.append(p);return;}
 for(const c of rows){
  const row=document.createElement("article");row.className="task-row";
  const main=document.createElement("div");main.className="task-main";
  const title=document.createElement("b");title.textContent=c.title;
  const reward=c.campaign_type==="task"?"₦"+(Number(c.reward_kobo||0)/100).toLocaleString("en-NG")+" per completion":"Daily reward ad gate";
  const meta=document.createElement("small");meta.textContent=reward+" · "+c.daily_limit+" ads/user/day";
  const budget=document.createElement("small");budget.textContent="Daily budget: "+(Number(c.daily_budget_kobo||0)>0?"₦"+(Number(c.daily_budget_kobo)/100).toLocaleString("en-NG"):"Not set")+" · Total: "+(Number(c.total_budget_kobo||0)>0?"₦"+(Number(c.total_budget_kobo)/100).toLocaleString("en-NG"):"Not set");
  main.append(title,meta,budget);row.append(main);
  const pill=document.createElement("span");pill.className="pill "+c.status;pill.textContent=c.status;row.append(pill);
  const actions=document.createElement("div");actions.className="row-actions";
  const edit=document.createElement("button");edit.textContent="Edit";edit.addEventListener("click",()=>editAdCampaign(c));actions.append(edit);
  if(c.status!=="archived"){
   const pause=document.createElement("button");pause.textContent=c.status==="active"?"Pause":"Activate";
   pause.addEventListener("click",async()=>{try{await invoke({action:"update_ad_campaign_status",id:c.id,status:c.status==="active"?"paused":"active"});toast("Campaign status updated.");await loadAdCampaigns();}catch(e){toast(e.message)}});
   const archive=document.createElement("button");archive.textContent="Archive";archive.addEventListener("click",async()=>{if(!window.confirm("Archive this ad campaign?"))return;try{await invoke({action:"update_ad_campaign_status",id:c.id,status:"archived"});toast("Campaign archived.");await loadAdCampaigns();}catch(e){toast(e.message)}});
   actions.append(pause,archive);
  }
  row.append(actions);root.append(row);
 }
}
$("adCampaignForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const type=$("adCampaignType").value;
 const amount=(id)=>Math.round(Number($(id).value||0)*100);
 const campaign={
  title:$("adTitle").value.trim(),description:$("adDescription").value.trim(),
  campaign_type:type,reward_kobo:type==="daily_reward"?0:amount("adReward"),
  daily_limit:Number($("adDailyLimit").value),
  daily_budget_kobo:amount("adDailyBudget"),total_budget_kobo:amount("adTotalBudget"),
status:$("adStatus").value
 };
 const id=$("adCampaignId").value;
 try{$("saveAdCampaign").disabled=true;const data=await invoke({action:"save_ad_campaign",id:id||undefined,campaign});$("adFormMessage").textContent="Saved successfully as "+data.campaign.status+".";toast(id?"Ad campaign updated.":"Ad campaign created.");clearAdCampaignForm();await loadAdCampaigns();}
 catch(err){$("adFormMessage").textContent=err.message;toast(err.message);}
 finally{$("saveAdCampaign").disabled=false;}
});
$("monetagSettingsForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const button=$("saveMonetagSettings");button.disabled=true;
 try{
  const data=await invoke({action:"save_monetag_settings",settings:{
   publisher_reference:$("monetagPublisherRef").value.trim(),
   sdk_zone_id:$("monetagZoneId").value.trim(),
   sdk_script_url:$("monetagScriptUrl").value.trim()
  }});
  $("monetagSetupStatus").textContent=data.provider.connection_status;
  toast("Monetag settings saved. Configure the postback before activation.");
  await loadAdCampaigns();
 }catch(error){toast(error.message);}
 finally{button.disabled=false;}
});
$("activateMonetag").addEventListener("click",async()=>{
 if(!window.confirm("Have you saved MONETAG_POSTBACK_SECRET in Supabase Edge Function secrets and configured the Monetag postback URL? Continue only if both are complete."))return;
 const button=$("activateMonetag");button.disabled=true;
 try{await invoke({action:"activate_monetag"});toast("Monetag connection marked active.");await loadAdCampaigns();}
 catch(error){toast(error.message);button.disabled=false;}
});
$("resetAdCampaign").addEventListener("click",clearAdCampaignForm);
$("refreshAdCampaigns").addEventListener("click",()=>loadAdCampaigns().catch(e=>toast(e.message)));
$("adCampaignType").addEventListener("change",updateAdRewardLabel);

async function start(){try{const {data:{session}}=await db.auth.getSession();if(!session){throw new Error("No signed-in session. Open NairaTask through Telegram first.")}const access=await db.functions.invoke("admin-check");if(access.error)throw new Error(access.data?.error||"Could not verify administrator access.");if(!access.data?.isAdmin){throw new Error("Your NairaTask account is not yet registered as an administrator.")}$("loading").classList.add("hidden");$("console").classList.remove("hidden");await loadTasks();await loadBankDetails();await loadWithdrawals();await loadAdCampaigns()}catch(e){$("loading").classList.add("hidden");$("denied").classList.remove("hidden");$("deniedText").textContent=e.message}}
$("taskForm").addEventListener("submit",async e=>{e.preventDefault();const reward=Number($("reward").value);if(!Number.isFinite(reward)||reward<0||reward>1000000){toast("Enter a valid reward amount.");return}const task={title:$("title").value.trim(),description:$("description").value.trim(),category:$("category").value,reward_kobo:Math.round(reward*100),destination_url:$("destination").value.trim()||null,proof_type:$("proofType").value,status:$("status").value,proof_instructions:$("proofInstructions").value.trim()||null,daily_limit:$("dailyLimit").value?Number($("dailyLimit").value):null,total_limit:$("totalLimit").value?Number($("totalLimit").value):null};const id=$("taskId").value;try{$("saveButton").disabled=true;await invoke(id?{action:"update_task",id,task}:{action:"create_task",task});$("formMessage").textContent="Saved successfully.";toast(id?"Task updated.":"Task created.");clearForm();await loadTasks()}catch(err){$("formMessage").textContent=err.message;toast(err.message)}finally{$("saveButton").disabled=false}});
$("resetButton").addEventListener("click",clearForm);$("refreshButton").addEventListener("click",()=>loadTasks().catch(e=>toast(e.message)));start();
$("refreshBankDetails")?.addEventListener("click",()=>loadBankDetails().catch(e=>toast(e.message)));

$("refreshWithdrawals")?.addEventListener("click",()=>loadWithdrawals().catch(e=>toast(e.message)));
