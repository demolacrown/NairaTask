const CONFIG = {
  supabaseUrl: "https://qezdxvyndsudckmreqlk.supabase.co",
  supabaseKey: "sb_publishable_YpR1Ru2j1QpkcPggrw1fMQ_ZB2df16w",
  telegramVerifyUrl: "https://qezdxvyndsudckmreqlk.supabase.co/functions/v1/telegram-verify"
};

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
    return;
  }
  const money = (kobo) => "₦" + (Number(kobo || 0) / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  $("balanceAmount").textContent = money(data.available_kobo);
  $("balanceNote").textContent = "Available balance · Pending: " + money(data.pending_kobo);
}


async function loadReferralSummary() {
  const { data, error } = await supabaseClient.rpc("get_my_referral_summary");
  if (error || !data) {
    $("referralCode").textContent = "Sign in to load";
    $("referralNotice").textContent = "Open NairaTask through Telegram to load your personal invite code.";
    return;
  }
  $("referralCode").textContent = data.referral_code || "Not available";
  $("referralTotal").textContent = Number(data.total_invites || 0);
  $("referralPending").textContent = Number(data.pending_invites || 0);
  $("referralQualified").textContent = Number(data.qualified_invites || 0);
  $("referralNotice").textContent = "Reward: ₦100 to the inviter only, after five approved rewarded-ad tasks. Rewards remain pending until ad revenue is verified.";
}

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

document.querySelectorAll("[data-page]").forEach((button) => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;
    if (page === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (page === "invite") {
      $("referralPanel").scrollIntoView({ behavior: "smooth", block: "center" });
      loadReferralSummary();
      return;
    }
    const messages = {
      tasks: "The published task list is shown on your Homepage.",
      wallet: "Your available wallet balance is shown above. Full wallet history is coming next."
    };
    toast(messages[page] || "This section is not available yet.");
  });
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
      tg.setHeaderColor("#101b2c");
      tg.setBackgroundColor("#f4f7fb");
    } catch (_) {}
  }

  await verifyTelegram();
  await loadTasks();
  await loadReferralSummary();
  setTimeout(playIntro, 350);
})();
