const CONFIG = {
  supabaseUrl: "https://qezdxvyndsudckmreqlk.supabase.co",
  supabaseKey: "sb_publishable_YpR1Ru2j1QpkcPggrw1fMQ_ZB2df16w",
  telegramVerifyUrl: "https://qezdxvyndsudckmreqlk.supabase.co/functions/v1/telegram-verify"
};


// Adsun integration is prepared in test mode. No ad block is activated until an
// approved placement ID is configured from the Adsun publisher workspace.
const ADSUN_DEBUG_MODE = true;
let adsunSdkPromise = null;
const adsunControllers = new Map();

function loadAdsunSdk() {
  if (window.Adsun) return Promise.resolve(window.Adsun);
  if (adsunSdkPromise) return adsunSdkPromise;
  adsunSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://api.adsun.io/sdk.js";
    script.async = true;
    script.onload = () => window.Adsun
      ? resolve(window.Adsun)
      : reject(new Error("Adsun SDK loaded but did not initialize."));
    script.onerror = () => reject(new Error("Adsun SDK could not be loaded."));
    document.head.appendChild(script);
  });
  return adsunSdkPromise;
}

async function showAdsunRewardedAd(blockId) {
  const placementId = String(blockId || "").trim();
  if (!/^\\d{1,80}$/.test(placementId)) {
    throw new Error("Ad placement is not configured yet.");
  }
  const ads = await loadAdsunSdk();
  let controller = adsunControllers.get(placementId);
  if (!controller) {
    controller = ads.init({ blockId: placementId, debug: ADSUN_DEBUG_MODE });
    controller.addEventListener("onReward", async () => {
      toast("Ad completion verified. Refreshing your wallet…");
      await loadWallet();
    });
    controller.addEventListener("onBannerNotFound", () => {
      toast("No eligible ad is available right now. Please try again later.");
    });
    controller.addEventListener("onNotSuitable", () => {
      toast("This ad view was not approved. No reward was added.");
    });
    controller.addEventListener("onError", () => {
      toast("The ad could not be played. Please try again later.");
    });
    adsunControllers.set(placementId, controller);
  }
  return await controller.show();
}

window.NairaTaskAdsun = Object.freeze({
  showRewardedAd: showAdsunRewardedAd,
  debugMode: ADSUN_DEBUG_MODE
});

const $ = (id) => document.getElementById(id);
const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
const headers = {
  apikey: CONFIG.supabaseKey,
  Authorization: "Bearer " + CONFIG.supabaseKey
};

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2800);
}

function showApp() {
  $("intro").classList.add("hidden");
  $("app").classList.remove("hidden");
}

function playIntro() {
  $("splash").classList.add("hidden");
  $("intro").classList.remove("hidden");
  setTimeout(showApp, 1500);
}

function setUser(user) {
  const name = user.first_name || user.username || "there";
  $("userName").textContent = name;
  $("welcomeMessage").textContent = user.username
    ? "@" + user.username + " · Complete tasks. Earn rewards."
    : "Complete tasks. Earn rewards.";
  $("avatar").textContent = (name.trim()[0] || "N").toUpperCase();

  if (user.photo_url) {
    const img = document.createElement("img");
    img.src = user.photo_url;
    img.alt = "Profile";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => {
      img.remove();
      $("avatar").textContent = (name[0] || "N").toUpperCase();
    };
    $("avatar").replaceChildren(img);
  }
}

function setNotice(title, message) {
  $("setupNotice").querySelector("b").textContent = title;
  $("setupNotice").querySelector("p").textContent = message;
}

async function verifyTelegram() {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (!tg || !tg.initData) {
    setUser({ first_name: "there" });
    setNotice(
      "Open through Telegram",
      "Launch NairaTask from its Telegram bot to verify your identity."
    );
    return;
  }

  tg.ready();
  tg.expand();

  try {
    const response = await fetch(CONFIG.telegramVerifyUrl, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ initData: tg.initData })
    });
    const result = await response.json();

    if (!response.ok || !result.verified) {
      throw new Error(result.error || "Telegram verification failed.");
    }

    const { data: sessionResult, error: sessionError } = await supabaseClient.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token
    });
    if (sessionError || !sessionResult.session) {
      throw new Error("Secure account session could not be saved. Reopen the Mini App.");
    }
    setUser(result.telegramUser);
    const startParam = tg.initDataUnsafe?.start_param || "";
    if (startParam.toLowerCase().startsWith("ref_")) {
      const referralCode = startParam.slice(4).trim();
      if (referralCode) {
        const { data: referralResult } = await supabaseClient.rpc("register_referral", { p_referral_code: referralCode });
        if (referralResult?.success) toast("Invite code applied successfully.");
      }
    }
    await loadReferralSummary();
    setNotice(
      "Account securely connected",
      "Your Telegram identity is verified and your NairaTask account is signed in."
    );
    await loadWallet();
    const { data: adminAccess } = await supabaseClient.functions.invoke("admin-check");
    if (adminAccess?.isAdmin) $("adminLink").classList.remove("hidden");
  } catch (error) {
    setNotice(
      "Identity verification needs attention",
      error.message + " Close and reopen the Mini App from Telegram."
    );
  }
}


let earningsSummary = null;
const formatNaira = (kobo) => "₦" + (Number(kobo || 0) / 100).toLocaleString("en-NG", {minimumFractionDigits:2,maximumFractionDigits:2});

async function loadEarningsSummary() {
  const { data, error } = await supabaseClient.rpc("get_my_earnings_summary");
  if (error || !data) {
    ["tasksEarnedAmount","referralEarnedAmount","tasksWithdrawAvailable","referralWithdrawAvailable"].forEach(id => { if ($(id)) $(id).textContent = "—"; });
    return;
  }
  earningsSummary = data;
  if ($("tasksEarnedAmount")) $("tasksEarnedAmount").textContent = formatNaira(data.tasks_earned_kobo);
  if ($("referralEarnedAmount")) $("referralEarnedAmount").textContent = formatNaira(data.referral_earned_kobo);
  if ($("referralEarnedNote")) $("referralEarnedNote").textContent = Number(data.referral_earned_kobo) > Number(data.referral_available_kobo)
    ? "Some rewards may still be pending or reserved" : "Approved referral rewards";
  if ($("tasksWithdrawAvailable")) $("tasksWithdrawAvailable").textContent = "Available: " + formatNaira(data.tasks_available_kobo);
  if ($("referralWithdrawAvailable")) $("referralWithdrawAvailable").textContent = "Available: " + formatNaira(data.referral_available_kobo);
  updateWithdrawalEligibility("tasks");
  updateWithdrawalEligibility("referral");
}

function updateWithdrawalEligibility(source) {
  if (!earningsSummary) return;
  const isTasks = source === "tasks";
  const amountInput = $(isTasks ? "tasksWithdrawAmount" : "referralWithdrawAmount");
  const notice = $(isTasks ? "tasksWithdrawNotice" : "referralWithdrawNotice");
  if (!amountInput || !notice) return;
  const available = Number(isTasks ? earningsSummary.tasks_available_kobo : earningsSummary.referral_available_kobo);
  const minimum = Number(isTasks ? earningsSummary.tasks_minimum_kobo : earningsSummary.referral_minimum_kobo);
  const amount = Math.round(Number(amountInput.value || 0) * 100);
  if (available < minimum) {
    notice.textContent = "Not eligible yet. You need at least " + formatNaira(minimum) + "; currently available: " + formatNaira(available) + ".";
  } else if (!amount) {
    notice.textContent = "You are eligible. Enter an amount from " + formatNaira(minimum) + " up to " + formatNaira(available) + ".";
  } else if (amount < minimum) {
    notice.textContent = "Amount is below the minimum of " + formatNaira(minimum) + ".";
  } else if (amount > available) {
    notice.textContent = "Insufficient " + source + " balance. Available: " + formatNaira(available) + ".";
  } else {
    notice.textContent = "Eligible to request " + formatNaira(amount) + " from " + source + ".";
  }
}

async function submitSourceWithdrawal(source, event) {
  event.preventDefault();
  const isTasks = source === "tasks";
  const input = $(isTasks ? "tasksWithdrawAmount" : "referralWithdrawAmount");
  const notice = $(isTasks ? "tasksWithdrawNotice" : "referralWithdrawNotice");
  const button = event.currentTarget.querySelector("button[type=submit]");
  const amount = Math.round(Number(input.value) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) { notice.textContent = "Enter a valid amount in naira."; return; }
  button.disabled = true;
  button.textContent = "Submitting…";
  try {
    const { data, error } = await supabaseClient.rpc("request_source_withdrawal", { p_source: source, p_amount_kobo: amount });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.message || "Withdrawal request could not be submitted.");
    notice.textContent = "Your " + source + " withdrawal request has been submitted for manual admin processing.";
    input.value = "";
    toast("Withdrawal request submitted.");
    await loadEarningsSummary();
  } catch (error) {
    notice.textContent = error.message || "Unable to submit withdrawal request.";
    toast(error.message || "Withdrawal request failed.");
    await loadEarningsSummary();
  } finally {
    button.disabled = false;
    button.textContent = isTasks ? "Request task withdrawal →" : "Request referral withdrawal →";
  }
}
$("tasksWithdrawAmount")?.addEventListener("input", () => updateWithdrawalEligibility("tasks"));
$("referralWithdrawAmount")?.addEventListener("input", () => updateWithdrawalEligibility("referral"));
$("tasksWithdrawForm")?.addEventListener("submit", event => submitSourceWithdrawal("tasks", event));
$("referralWithdrawForm")?.addEventListener("submit", event => submitSourceWithdrawal("referral", event));

async function loadWallet() {
  const { data: userResult } = await supabaseClient.auth.getUser();
  if (!userResult.user) return;
  const { data, error } = await supabaseClient
    .from("wallets")
    .select("available_kobo,pending_kobo,lifetime_earned_kobo")
    .eq("user_id", userResult.user.id)
    .maybeSingle();
  if (error || !data) {
    $("balanceAmount").textContent = "₦ —";
    $("balanceNote").textContent = "Wallet is being prepared.";
    await loadEarningsSummary();
    return;
  }
  const money = (kobo) => "₦" + (Number(kobo || 0) / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  $("balanceAmount").textContent = money(data.available_kobo);
  $("balanceNote").textContent = "Available balance · Pending: " + money(data.pending_kobo);
  if ($("walletBalanceAmount")) { $("walletBalanceAmount").textContent = $("balanceAmount").textContent; $("walletBalanceNote").textContent = $("balanceNote").textContent; }
  await loadEarningsSummary();
}


async function loadReferralSummary() {
  const { data, error } = await supabaseClient.rpc("get_my_referral_summary");
  if (error || !data) {
    $("referralCode").textContent = "Sign in to load";
    $("referralNotice").textContent = "Open NairaTask through Telegram to load your personal invite code.";
    return;
  }
  const code = data.referral_code || "";
  $("referralCode").textContent = code || "Not available";
  const referralLink = code ? `https://t.me/NairaTaskRewardsBot?startapp=ref_${encodeURIComponent(code)}` : "";
  const linkField = $("referralLink");
  if (linkField) linkField.value = referralLink;
  const linkButton = $("copyReferralLink");
  if (linkButton) linkButton.disabled = !referralLink;
  $("referralTotal").textContent = Number(data.total_invites || 0);
  $("referralPending").textContent = Number(data.pending_invites || 0);
  $("referralQualified").textContent = Number(data.qualified_invites || 0);
  $("referralNotice").textContent = "Reward: ₦100 to the inviter only, after five approved rewarded-ad tasks. Rewards remain pending until ad revenue is verified.";
}

$("copyReferralLink")?.addEventListener("click", async () => {
  const link = $("referralLink")?.value?.trim();
  if (!link) {
    toast("Your referral link is not ready yet.");
    return;
  }
  try {
    await navigator.clipboard.writeText(link);
    toast("Referral link copied. Share it with your friends.");
  } catch (_) {
    $("referralLink").focus();
    $("referralLink").select();
    toast("Select and copy your referral link.");
  }
});

$("copyReferralCode").addEventListener("click", async () => {
  const code = $("referralCode").textContent.trim();
  if (!code || code === "Loading…" || code === "Sign in to load" || code === "Not available") {
    toast("Your invite code is not ready yet.");
    return;
  }
  try {
    await navigator.clipboard.writeText(code);
    toast("Invite code copied. Share it with your friend.");
  } catch (_) {
    toast("Your invite code is " + code);
  }
});

$("referralInput").addEventListener("input", () => {
  $("applyReferral").disabled = !$("referralInput").value.trim();
});
$("applyReferral").addEventListener("click", async () => {
  const button = $("applyReferral");
  const code = $("referralInput").value.trim().toUpperCase();
  if (!code) return;
  button.disabled = true;
  button.textContent = "Applying…";
  try {
    const { data, error } = await supabaseClient.rpc("register_referral", { p_referral_code: code });
    if (error) throw error;
    $("referralNotice").textContent = data?.message || "Referral code processed.";
    if (data?.success) {
      $("referralInput").value = "";
      toast("Invite code applied.");
    } else {
      toast(data?.message || "Invite code could not be applied.");
    }
    await loadReferralSummary();
  } catch (error) {
    $("referralNotice").textContent = error.message || "Sign in through Telegram to apply a code.";
  } finally {
    button.textContent = "Apply";
    button.disabled = !$("referralInput").value.trim();
  }
});

function renderEmptyTasks(message) {
  const target = $("taskList");
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = message;
  target.replaceChildren(empty);
}

async function loadTasks() {
  const target = $("taskList");
  try {
    const query = new URLSearchParams({
      select: "id,title,description,category,reward_kobo,destination_url,proof_type,proof_instructions,status,starts_at,ends_at",
      status: "eq.published",
      order: "created_at.desc",
      limit: "12"
    });
    const response = await fetch(
      CONFIG.supabaseUrl + "/rest/v1/tasks?" + query.toString(),
      { headers }
    );

    if (!response.ok) {
      throw new Error("Task service returned " + response.status);
    }

    const tasks = await response.json();
    target.replaceChildren();

    if (!tasks.length) {
      renderEmptyTasks("No tasks have been published yet. New tasks will appear here when the administrator publishes them.");
      return;
    }

    for (const task of tasks) {
      const card = document.createElement("article");
      card.className = "task-card";

      const icon = document.createElement("div");
      icon.className = "task-icon";
      const icons = {
        telegram: "✈",
        whatsapp: "◉",
        rewarded_ad: "▶",
        instant_link: "↗",
        sponsor: "★"
      };
      icon.textContent = icons[task.category] || "↗";

      const info = document.createElement("div");
      info.className = "task-info";
      const title = document.createElement("b");
      title.textContent = task.title;
      const description = document.createElement("p");
      description.textContent = task.description || "Open for task instructions.";
      info.append(title, description);

      const reward = document.createElement("span");
      reward.className = "task-reward";
      reward.textContent = "₦" + (Number(task.reward_kobo || 0) / 100).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      card.append(icon, info, reward);
      card.addEventListener("click", () => {
        if (task.destination_url) {
          const tg = window.Telegram && window.Telegram.WebApp;
          if (tg && typeof tg.openLink === "function") {
            tg.openLink(task.destination_url);
          } else {
            window.open(task.destination_url, "_blank", "noopener,noreferrer");
          }
        } else {
          toast(task.proof_instructions || "Task instructions have not been added yet.");
        }
      });
      target.append(card);
    }
  } catch (error) {
    renderEmptyTasks("Tasks are temporarily unavailable. Please try again later.");
    console.error("NairaTask task loading:", error);
  }
}

function showPage(page){
  const allowed=["home","tasks","invite","wallet"];
  const target=allowed.includes(page)?page:"home";
  document.querySelectorAll(".page-view").forEach(el=>el.classList.toggle("active",el.dataset.view===target));
  document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.page===target));
  window.scrollTo({top:0,behavior:"smooth"});
  if(target==="invite") loadReferralSummary();
  if(target==="wallet"){loadWallet();loadSavedBankDetails();loadEarningsSummary();}
}
document.querySelectorAll("[data-page]").forEach(button=>{
  button.addEventListener("click",event=>{
    event.preventDefault();
    showPage(button.dataset.page);
  });
});

$("accountNumber").addEventListener("input",()=>{
  $("accountNumber").value=$("accountNumber").value.replace(/\D/g,"").slice(0,10);
});
async function loadSavedBankDetails(){
  const {data:userResult}=await supabaseClient.auth.getUser();
  if(!userResult.user)return;
  const {data,error}=await supabaseClient.from("user_bank_details")
    .select("bank_name,account_number,account_name,review_status,submitted_at")
    .eq("user_id",userResult.user.id).maybeSingle();
  if(error){$("bankDetailsNotice").textContent="Could not load saved bank details. Please retry.";return;}
  if(!data){$("bankDetailsNotice").textContent="No bank details submitted yet.";return;}
  $("bankSelect").value=data.bank_name;
  $("accountNumber").value=data.account_number;
  $("accountName").value=data.account_name;
  $("bankDetailsNotice").textContent=data.review_status==="reviewed"
    ?"Your bank details have been reviewed by the admin team."
    :"Your bank details have been submitted and are waiting for admin review.";
  $("saveBankDetails").innerHTML="Update bank details <span>→</span>";
}
$("bankDetailsForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const button=$("saveBankDetails");
  const bankName=$("bankSelect").value;
  const accountNumber=$("accountNumber").value.trim();
  const accountName=$("accountName").value.trim().replace(/\s+/g," ");
  const allowedBanks=["OPay","PalmPay","Moniepoint","MoMo PSB"];
  if(!allowedBanks.includes(bankName)){toast("Choose one of the four supported banks.");return;}
  if(!/^\d{10}$/.test(accountNumber)){toast("Enter a valid 10-digit account number.");return;}
  if(accountName.length<2){toast("Enter the account holder's full name.");return;}
  button.disabled=true;
  button.textContent="Submitting…";
  $("bankDetailsNotice").textContent="Saving your bank details securely…";
  try{
    const {data:userResult,error:userError}=await supabaseClient.auth.getUser();
    if(userError||!userResult.user)throw new Error("Sign in through Telegram before submitting bank details.");
    const {error}=await supabaseClient.from("user_bank_details").upsert({
      user_id:userResult.user.id,bank_name:bankName,account_number:accountNumber,
      account_name:accountName,review_status:"submitted",submitted_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    },{onConflict:"user_id"});
    if(error)throw error;
    $("bankDetailsNotice").textContent="Submitted successfully. Your bank details are now waiting for admin review.";
    button.innerHTML="Update bank details <span>→</span>";
    toast("Bank details submitted for review.");
  }catch(error){
    $("bankDetailsNotice").textContent=error.message||"Unable to submit bank details. Please try again.";
    toast(error.message||"Submission failed.");
  }finally{button.disabled=false;}
});

$("dailyRewardButton").addEventListener("click", async () => {
  const button = $("dailyRewardButton");
  button.disabled = true;
  try {
    const { data, error } = await supabaseClient.rpc("claim_daily_checkin");
    if (error) throw error;
    if (!data?.success) {
      toast(data?.message || "Daily reward could not be claimed.");
      return;
    }
    toast("Daily reward added: ₦" + (Number(data.amount_kobo || 0) / 100).toFixed(2));
    await loadWallet();
  } catch (error) {
    toast(error.message || "Sign in through Telegram to claim your daily reward.");
  } finally {
    button.disabled = false;
  }
});
$("promoButton").addEventListener("click", async () => {
  const button = $("promoButton");
  const code = $("promoInput").value.trim().toUpperCase();
  if (!code) return;
  button.disabled = true;
  button.textContent = "Checking…";
  $("promoNotice").textContent = "Checking your promo code securely…";
  try {
    const { data, error } = await supabaseClient.rpc("redeem_promo_code", {
      p_code: code
    });
    if (error) throw error;
    if (!data?.success) {
      $("promoNotice").textContent = data?.message || "This promo code could not be redeemed.";
      toast(data?.message || "Promo code could not be redeemed.");
      return;
    }
    const amount = (Number(data.amount_kobo || 0) / 100).toFixed(2);
    $("promoInput").value = "";
    $("promoNotice").textContent = "Success! ₦" + amount + " has been added to your wallet.";
    toast("Promo redeemed: ₦" + amount);
    await loadWallet();
  } catch (error) {
    $("promoNotice").textContent = "Sign in through Telegram to redeem a promo code.";
    toast(error.message || "Promo redemption failed. Please try again.");
  } finally {
    button.textContent = "Redeem";
    button.disabled = !$("promoInput").value.trim();
  }
});
$("notificationsButton").addEventListener("click", () => {
  toast("You're all caught up.");
});
$("promoInput").addEventListener("input", (event) => {
  $("promoButton").disabled = !event.target.value.trim();
});

(async function init() {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    try {
      tg.setHeaderColor("#071b14");
      tg.setBackgroundColor("#071b14");
    } catch (_) {}
  }

  await verifyTelegram();
  await loadTasks();
  await loadReferralSummary();
  $("walletBalanceAmount").textContent=$("balanceAmount").textContent;
  $("walletBalanceNote").textContent=$("balanceNote").textContent;
  setTimeout(playIntro, 350);
})();
