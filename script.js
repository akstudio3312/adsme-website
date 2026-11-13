// AdsMe V1 browser code. Privileged operations must still be enforced by Supabase RLS.

// Supabase publishable keys are intended for browser clients. Never place a secret/service-role key here.
const SUPABASE_URL = "https://szsxdtubmyduicfjyyzx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_U5gMM3gXe6vYH_wUlpnQHw_tjpwE7tD";
const MEDIA_BUCKET = "ads-media";
const supabaseClient = window.supabase?.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

// The Instagram URL was not supplied correctly; it was the same YouTube URL.
const SOCIAL = {
  instagram: "",
  youtube: "https://youtube.com/@ak.studio_official12?si=SJPb0X1QZ-j4LX51",
  whatsapp: "https://whatsapp.com/channel/0029Vb9YlFwLCoX5WWqAz72u"
};

const CATEGORIES = [
  "Technology", "Fashion", "Food and Beverage", "Footwear", "Electronics",
  "Home and Furniture", "Beauty and Personal Care", "Education", "Healthcare",
  "Travel and Tourism", "Real Estate", "Automotive",
  "Business and Professional Services", "Other"
];

// These are clearly labeled preview examples, used until AdsMe has published database records.
const PREVIEW_ADS = [
  { title: "Bold by Nature.", category: "Beauty and Personal Care", description: "A refined fragrance for everyday moments and confident style.", campaign: "Fragrance Edit", keywords: "fragrance perfume scent beauty", visual: "g-perfume" },
  { title: "Time, refined.", category: "Electronics", description: "A classic watch designed for precision and everyday wear.", campaign: "Watches Showcase", keywords: "watches watch time accessories", visual: "g-watch" },
  { title: "Design your comfort.", category: "Home and Furniture", description: "Thoughtful furniture to make every room feel like yours.", campaign: "Home Collection", keywords: "furniture home interior living room sofa", visual: "g-home" },
  { title: "Fresh taste.", category: "Food and Beverage", description: "Fresh flavours made for sharing with friends and family.", campaign: "Food Showcase", keywords: "food beverage drink restaurant cafe", visual: "g-food" }
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const searchInput = $("#searchInput");
const searchStatus = $("#searchStatus");
const resultsLabel = $("#resultsLabel");
const adGrid = $("#adGrid");
const emptyMsg = $("#emptyMsg");
const chips = $("#chips");
const catGrid = $("#catGrid");
const googleSignIn = $("#googleSignIn");
const signInButtonMarkup = googleSignIn.innerHTML;
const thirdTab = $("#thirdTab");
const thirdLabel = $("#thirdLabel");

let selectedCategory = "all";
let liveAds = [];
let categoryRows = [];
let campaignRows = [];
let currentSession = null;
let currentUser = null;
let accountType = "visitor"; // Display state only; Supabase policies enforce permissions.
let isSuperAdmin = false;
let adminChoiceDialog;
let profileDialog;
let adminInfoDialog;
let toastTimer;
let uploadNoticeState = null;

function showToast(message){
  let toast = $("#adsmeToast");
  if (!toast){
    toast = document.createElement("div");
    toast.id = "adsmeToast";
    toast.className = "adsme-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
  }
  // A modal is in the browser's top layer; body-level notifications sit behind it.
  const host = [...document.querySelectorAll("dialog[open]")].pop() || document.body;
  if (toast.parentElement !== host) host.appendChild(toast);
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 4200);
}

function renderUploadNotice(){
  const notice = document.getElementById("adminUploadNotice");
  if (!notice) return;
  notice.hidden = !uploadNoticeState;
  if (!uploadNoticeState) return;
  notice.className = uploadNoticeState.error ? "admin-error" : "admin-help";
  notice.setAttribute("role", uploadNoticeState.error ? "alert" : "status");
  notice.textContent = uploadNoticeState.message;
}

function setUploadNotice(message, error = false){
  uploadNoticeState = { message, error };
  renderUploadNotice();
}

function configureSocialLink(id, url, platform){
  const link = document.getElementById(id);
  if (!link) return;
  if (url){
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.removeAttribute("aria-disabled");
    link.title = `Visit AdsMe on ${platform}`;
    return;
  }
  link.removeAttribute("href");
  link.setAttribute("aria-disabled", "true");
  link.title = `The official AdsMe ${platform} link has not been supplied yet`;
  link.addEventListener("click", event => {
    event.preventDefault();
    showToast(`Please send the official AdsMe ${platform} URL to activate this link.`);
  });
}

configureSocialLink("linkInstagram", SOCIAL.instagram, "Instagram");
configureSocialLink("linkYoutube", SOCIAL.youtube, "YouTube");
configureSocialLink("linkWhatsapp", SOCIAL.whatsapp, "WhatsApp Channel");

function normalize(value){
  return String(value ?? "").toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function createChip(category){
  const chip = document.createElement("button");
  chip.className = "chip";
  chip.type = "button";
  chip.dataset.cat = category;
  chip.textContent = category;
  chips.appendChild(chip);

  const tile = document.createElement("button");
  tile.className = "cat-tile";
  tile.type = "button";
  tile.textContent = category;
  tile.addEventListener("click", () => {
    selectChip(category);
    document.getElementById("explore").scrollIntoView({ behavior: "smooth" });
  });
  catGrid.appendChild(tile);
}

function renderCategoryControls(rows = []){
  const names = [...new Set([
    ...CATEGORIES,
    ...rows.map(row => row.name).filter(Boolean)
  ])];
  $$(".chip:not([data-cat='all'])", chips).forEach(chip => chip.remove());
  catGrid.replaceChildren();
  names.forEach(createChip);
}

function selectChip(category){
  selectedCategory = category;
  $$(".chip", chips).forEach(chip => chip.classList.toggle("on", chip.dataset.cat === category));
  updateSearchResults();
}

renderCategoryControls();
chips.addEventListener("click", event => {
  const chip = event.target.closest(".chip");
  if (chip && chips.contains(chip)) selectChip(chip.dataset.cat);
});

// Sidebar
const sidebar = $("#sidebar");
const overlay = $("#overlay");
const openSidebar = () => { sidebar.classList.add("open"); overlay.classList.add("show"); };
const closeSidebar = () => { sidebar.classList.remove("open"); overlay.classList.remove("show"); };
$("#openSidebar").addEventListener("click", openSidebar);
$("#closeSidebar").addEventListener("click", closeSidebar);
overlay.addEventListener("click", closeSidebar);
sidebar.querySelectorAll("[data-close]").forEach(link => link.addEventListener("click", closeSidebar));

// Carousel dots
const carousel = $("#carousel");
const dotsContainer = $("#dots");
const previewCarouselMarkup = carousel.innerHTML;
const previewDotsMarkup = dotsContainer.innerHTML;
carousel.addEventListener("scroll", () => {
  if (!carousel.firstElementChild) return;
  const dots = $("#dots i");
  if (!dots.length) return;
  const width = carousel.firstElementChild.getBoundingClientRect().width + 14;
  const activeIndex = Math.min(dots.length - 1, Math.round(carousel.scrollLeft / width));
  dots.forEach((dot, index) => dot.classList.toggle("on", index === activeIndex));
});

function getSearchText(ad){
  return normalize([
    ad.title,
    ad.description,
    ad.category,
    ad.advertiser,
    ad.campaign,
    ad.keywords,
    ad.websiteUrl
  ].join(" "));
}

function safeExternalUrl(value){
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function createAdCard(ad, previewMode){
  const card = document.createElement("article");
  card.className = "search-ad-card";

  let media;
  if (ad.videoUrl){
    media = document.createElement("video");
    media.className = "search-ad-media";
    media.controls = true;
    media.preload = "none";
    media.playsInline = true;
    media.src = ad.videoUrl;
    if (ad.thumbnailUrl) media.poster = ad.thumbnailUrl;
    media.setAttribute("aria-label", `Play ${ad.title}`);
  } else if (ad.thumbnailUrl){
    media = document.createElement("img");
    media.className = "search-ad-media";
    media.src = ad.thumbnailUrl;
    media.alt = ad.title;
    media.loading = "lazy";
  } else {
    media = document.createElement("div");
    media.className = `search-ad-media search-thumb ${ad.visual || "g-tech"}`;
    media.setAttribute("aria-hidden", "true");
  }

  const info = document.createElement("div");
  info.className = "search-ad-info";
  const category = document.createElement("small");
  category.textContent = ad.category || "Other";
  const title = document.createElement("h4");
  title.textContent = ad.title || "Untitled advertisement";
  const description = document.createElement("p");
  description.textContent = ad.description || "";
  info.append(category, title);
  if (description.textContent) info.appendChild(description);

  const details = [ad.advertiser, ad.campaign, previewMode ? "Preview ad" : ""].filter(Boolean).join(" · ");
  if (details){
    const meta = document.createElement("p");
    meta.className = "search-campaign";
    meta.textContent = details;
    info.appendChild(meta);
  }

  const websiteUrl = safeExternalUrl(ad.websiteUrl);
  if (websiteUrl){
    const website = document.createElement("a");
    website.className = "ad-website-link";
    website.href = websiteUrl;
    website.target = "_blank";
    website.rel = "noopener noreferrer";
    website.textContent = "Visit advertiser →";
    info.appendChild(website);
  }

  card.append(media, info);
  return card;
}

function renderHeroCarousel(){
  const featuredAds = liveAds.filter(ad => ad.is_featured === true);

  if (!featuredAds.length){
    if (carousel.dataset.hasLiveAds === "true"){
      carousel.innerHTML = previewCarouselMarkup;
      dotsContainer.innerHTML = previewDotsMarkup;
      delete carousel.dataset.hasLiveAds;
    }
    return;
  }

  carousel.replaceChildren();
  dotsContainer.replaceChildren();
  featuredAds.forEach((ad, index) => {
    const slide = document.createElement("article");
    slide.className = "hero";
    if (ad.thumbnailUrl){
      slide.style.backgroundImage = `linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.78)),url(${JSON.stringify(ad.thumbnailUrl)})`;
      slide.style.backgroundSize = "cover";
      slide.style.backgroundPosition = "center";
    } else {
      slide.classList.add("g-tech");
    }

    const category = document.createElement("span");
    category.className = "cat";
    category.textContent = ad.category || "Other";

    const title = document.createElement("h2");
    title.textContent = ad.title || "Untitled advertisement";

    const description = document.createElement("p");
    description.textContent = ad.description || "";

    const actions = document.createElement("div");
    actions.className = "hero-btns";
    const viewLink = document.createElement("a");
    viewLink.href = "#explore";
    viewLink.className = "btn-yellow";
    viewLink.textContent = "View Ad →";
    viewLink.addEventListener("click", () => {
      searchInput.value = ad.title || "";
      selectChip("all");
      updateSearchResults();
      document.getElementById("explore").scrollIntoView({ behavior: "smooth" });
    });

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "btn-circle";
    saveButton.setAttribute("aria-label", "Save");
    saveButton.textContent = "+";
    actions.append(viewLink, saveButton);
    slide.append(category, title);
    if (description.textContent) slide.appendChild(description);
    slide.appendChild(actions);
    carousel.appendChild(slide);

    const dot = document.createElement("i");
    if (index === 0) dot.className = "on";
    dotsContainer.appendChild(dot);
  });
  carousel.dataset.hasLiveAds = "true";
  carousel.scrollLeft = 0;
}

function updateSearchResults(){
  if (!searchInput || !adGrid) return;
  const rawQuery = searchInput.value.trim();
  const terms = normalize(rawQuery).split(/\s+/).filter(Boolean);
  const previewMode = liveAds.length === 0;
  const ads = previewMode ? PREVIEW_ADS : liveAds;
  const matches = ads.filter(ad => {
    const categoryMatches = selectedCategory === "all" || ad.category === selectedCategory;
    const text = getSearchText(ad);
    const queryMatches = terms.length === 0 || terms.every(term => text.includes(term));
    return categoryMatches && queryMatches;
  });
  const hasFilter = terms.length > 0 || selectedCategory !== "all";

  adGrid.replaceChildren();
  if (!hasFilter){
    emptyMsg.textContent = liveAds.length
      ? "Search for an advertisement or choose a category to explore."
      : "No advertisements published yet. Search to try the preview ads.";
    emptyMsg.hidden = false;
    adGrid.appendChild(emptyMsg);
    searchStatus.hidden = true;
    resultsLabel.hidden = true;
    return;
  }

  const countText = `${matches.length} ${previewMode ? "preview " : ""}${matches.length === 1 ? "ad" : "ads"}`;
  const queryText = rawQuery ? ` for “${rawQuery}”` : "";
  const categoryText = selectedCategory === "all" ? "" : ` in ${selectedCategory}`;
  searchStatus.textContent = `${countText} found${queryText}${categoryText}${previewMode ? ". Preview examples only." : "."}`;
  searchStatus.hidden = false;
  resultsLabel.textContent = `${countText}${queryText}${categoryText}${previewMode ? " · Preview content" : ""}`;
  resultsLabel.hidden = false;

  if (!matches.length){
    const noResults = document.createElement("p");
    noResults.className = "empty";
    noResults.textContent = "No advertisements match this search. Try another word or category.";
    adGrid.appendChild(noResults);
    return;
  }
  matches.forEach(ad => adGrid.appendChild(createAdCard(ad, previewMode)));
}

searchInput.addEventListener("input", updateSearchResults);
searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && searchInput.value.trim()){
    event.preventDefault();
    document.getElementById("explore").scrollIntoView({ behavior: "smooth" });
  }
});

async function getStorageLink(path){
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabaseClient.storage.from(MEDIA_BUCKET).createSignedUrl(path, 3600);
  return error ? "" : data?.signedUrl || "";
}

async function loadReferenceData(){
  if (!supabaseClient) return;
  const [categoriesResult, campaignsResult] = await Promise.all([
    supabaseClient.from("categories").select("*").order("name"),
    supabaseClient.from("campaigns").select("id,name")
  ]);
  if (!categoriesResult.error && categoriesResult.data?.length){
    categoryRows = categoriesResult.data;
    renderCategoryControls(categoryRows);
  }
  if (!campaignsResult.error) campaignRows = campaignsResult.data || [];
}

async function loadPublishedAds(){
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient
    .from("ads")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const categoryById = new Map(categoryRows.map(row => [row.id, row.name]));
  const campaignById = new Map(campaignRows.map(row => [row.id, row.name]));
  liveAds = await Promise.all((data || []).map(async row => {
    const [videoUrl, thumbnailUrl] = await Promise.all([
      getStorageLink(row.video_path),
      getStorageLink(row.thumbnail_path)
    ]);
    return {
      ...row,
      title: row.title || "Untitled advertisement",
      category: categoryById.get(row.category_id) || row.category || "Other",
      campaign: campaignById.get(row.campaign_id) || row.campaign_name || "",
      advertiser: row.advertiser_name || row.business_name || row.advertiser || "",
      description: row.description || "",
      keywords: row.keywords || "",
      websiteUrl: row.website_url || row.website || "",
      videoUrl,
      thumbnailUrl
    };
  }));
}

async function refreshPublicContent(){
  if (!supabaseClient){
    showToast("Supabase client did not load. Check the internet connection and reload.");
    updateSearchResults();
    return;
  }
  try {
    await loadReferenceData();
    await loadPublishedAds();
    renderHeroCarousel();
    updateSearchResults();
  } catch (error){
    console.error("AdsMe content could not be loaded:", error.message);
    showToast("Published ads could not load. Check the Supabase table and RLS setup.");
    updateSearchResults();
  }
}

function getChoiceKey(userId){ return `adsme-entry-choice:${userId}`; }

async function readAdminPermissions(){
  if (!supabaseClient || !currentUser) return { admin: false, superAdmin: false };
  const [adminResult, superResult] = await Promise.all([
    supabaseClient.rpc("has_admin_access"),
    supabaseClient.rpc("is_super_admin")
  ]);
  const superAdminAllowed = !superResult.error && superResult.data === true;
  const adminAllowed = !adminResult.error && adminResult.data === true;
  return { admin: adminAllowed || superAdminAllowed, superAdmin: superAdminAllowed };
}

function renderAccount(){
  if (!currentUser){
    googleSignIn.innerHTML = signInButtonMarkup;
    googleSignIn.setAttribute("aria-label", "Sign in with Google");
    thirdLabel.textContent = "Sign In";
    thirdTab.setAttribute("aria-label", "Sign in");
    return;
  }

  const metadata = currentUser.user_metadata || {};
  const avatarUrl = metadata.avatar_url || metadata.picture || "";
  const displayName = metadata.full_name || metadata.name || currentUser.email || "Google profile";
  googleSignIn.replaceChildren();
  if (avatarUrl){
    const avatar = document.createElement("img");
    avatar.className = "account-avatar";
    avatar.src = avatarUrl;
    avatar.alt = "";
    googleSignIn.appendChild(avatar);
  }
  const name = document.createElement("span");
  name.textContent = displayName;
  googleSignIn.appendChild(name);
  googleSignIn.setAttribute("aria-label", "Open Google profile");
  thirdLabel.textContent = accountType === "admin" ? "Admin Dashboard" : "Profile";
  thirdTab.setAttribute("aria-label", thirdLabel.textContent);
}

function buildDialog(id, titleText, descriptionText){
  let dialog = document.getElementById(id);
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = id;
  dialog.className = "adsme-dialog";
  const title = document.createElement("h2");
  title.textContent = titleText;
  const description = document.createElement("p");
  description.textContent = descriptionText;
  const body = document.createElement("div");
  body.className = "dialog-body";
  const actions = document.createElement("div");
  actions.className = "dialog-actions";
  dialog.append(title, description, body, actions);
  document.body.appendChild(dialog);
  dialog._body = body;
  dialog._actions = actions;
  return dialog;
}

function makeDialogButton(label, className, onClick){
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function showAdminChoice(){
  adminChoiceDialog = buildDialog(
    "adminChoiceDialog",
    "Are you an Admin?",
    "Choose how you want to enter AdsMe. Your permission is checked securely by Supabase."
  );
  adminChoiceDialog._body.replaceChildren();
  adminChoiceDialog._actions.replaceChildren();
  adminChoiceDialog._actions.append(
    makeDialogButton("YES", "dialog-button primary", async () => {
      adminChoiceDialog.close();
      const permission = await readAdminPermissions();
      isSuperAdmin = permission.superAdmin;
      if (permission.admin){
        accountType = "admin";
        try { sessionStorage.setItem(getChoiceKey(currentUser.id), "admin"); } catch {}
        showToast(isSuperAdmin ? "Super Admin access verified." : "Admin access verified.");
      } else {
        accountType = "user";
        showToast("This Google account is not on the authorized Admin list. Opening the visitor profile.");
      }
      renderAccount();
    }),
    makeDialogButton("NO", "dialog-button", () => {
      adminChoiceDialog.close();
      accountType = "user";
      try { sessionStorage.setItem(getChoiceKey(currentUser.id), "normal"); } catch {}
      renderAccount();
    })
  );
  if (!adminChoiceDialog.open) adminChoiceDialog.showModal();
}

function showProfile(){
  if (!currentUser) return;
  profileDialog = buildDialog("profileDialog", "Your AdsMe Profile", "Your Google account profile is connected to AdsMe.");
  profileDialog._body.replaceChildren();
  profileDialog._actions.replaceChildren();
  const metadata = currentUser.user_metadata || {};
  const name = document.createElement("p");
  name.className = "profile-name";
  name.textContent = metadata.full_name || metadata.name || "AdsMe user";
  const email = document.createElement("p");
  email.textContent = currentUser.email || "";
  const role = document.createElement("p");
  role.className = "profile-role";
  role.textContent = isSuperAdmin ? "Super Admin" : accountType === "admin" ? "Admin" : "Registered user";
  profileDialog._body.append(name, email, role);
  profileDialog._actions.append(
    makeDialogButton("Sign out", "dialog-button", async () => {
      const { error } = await supabaseClient.auth.signOut();
      profileDialog.close();
      if (error) showToast("Sign out failed. Please try again.");
    }),
    makeDialogButton("Close", "dialog-button primary", () => profileDialog.close())
  );
  profileDialog.showModal();
}

function makeAdminElement(tag, className, text){
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function makeAdminField(labelText, control){
  const label = makeAdminElement("label", "admin-field");
  label.append(makeAdminElement("span", "", labelText), control);
  return label;
}

function makeAdminSelect(options, placeholder){
  const select = document.createElement("select");
  select.required = true;
  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  first.disabled = true;
  first.selected = true;
  select.appendChild(first);
  options.forEach(option => {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    select.appendChild(item);
  });
  return select;
}

async function getAdminAds(){
  const { data, error } = await supabaseClient.from("ads").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getAdminCampaigns(){
  const { data, error } = await supabaseClient.from("campaigns").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

function renderAdminDashboard(){
  adminInfoDialog = buildDialog("adminInfoDialog", "Admin Dashboard", "Verified AdsMe administration tools.");
  adminInfoDialog.classList.add("admin-dialog");
  adminInfoDialog.querySelector("h2").textContent = "Admin Dashboard";
  adminInfoDialog.querySelector(":scope > p").textContent = isSuperAdmin
    ? "Super Admin access verified. Manage AdsMe content and Admin permissions."
    : "Admin access verified. Manage AdsMe advertisements and campaigns.";
  adminInfoDialog._body.replaceChildren();
  adminInfoDialog._actions.replaceChildren(makeDialogButton("Close", "dialog-button primary", () => adminInfoDialog.close()));

  const navigation = makeAdminElement("div", "admin-tabs");
  const panel = makeAdminElement("div", "admin-panel");
  const notice = makeAdminElement("p", "admin-help");
  notice.id = "adminUploadNotice";
  notice.hidden = true;
  notice.setAttribute("aria-atomic", "true");
  adminInfoDialog._body.append(navigation, notice, panel);
  renderUploadNotice();

  const pages = [
    ["Overview", renderAdminOverview],
    ["Upload Ads", renderAdminUpload],
    ["Manage Ads", renderAdminManageAds],
    ["Campaigns", renderAdminCampaigns]
  ];
  if (isSuperAdmin) pages.push(["Admin Management", renderAdminManagement]);

  function openPage(label, render){
    navigation.querySelectorAll("button").forEach(button => button.classList.toggle("active", button.textContent === label));
    panel.replaceChildren();
    Promise.resolve(render(panel)).catch(error => {
      panel.replaceChildren(makeAdminElement("p", "admin-error", `Could not open ${label}: ${error.message}`));
    });
  }
  pages.forEach(([label, render], index) => {
    const button = makeAdminElement("button", `admin-tab${index === 0 ? " active" : ""}`, label);
    button.type = "button";
    button.addEventListener("click", () => openPage(label, render));
    navigation.appendChild(button);
  });
  openPage(pages[0][0], pages[0][1]);
  if (!adminInfoDialog.open) adminInfoDialog.showModal();
}

async function renderAdminOverview(panel){
  const [ads, campaigns] = await Promise.all([getAdminAds(), getAdminCampaigns()]);
  const counts = [
    ["All ads", ads.length],
    ["Published", ads.filter(ad => ad.status === "published").length],
    ["Drafts", ads.filter(ad => ad.status === "draft").length],
    ["Campaigns", campaigns.length]
  ];
  const cards = makeAdminElement("div", "admin-stat-grid");
  counts.forEach(([label, value]) => {
    const card = makeAdminElement("div", "admin-stat-card");
    card.append(makeAdminElement("span", "", label), makeAdminElement("strong", "", String(value)));
    cards.appendChild(card);
  });
  panel.append(cards, makeAdminElement("p", "admin-help", "Only published advertisements appear in public Explore. Supabase RLS remains responsible for enforcing these permissions."));
}

async function renderAdminUpload(panel){
  if (!categoryRows.length || !campaignRows.length) await loadReferenceData();
  const form = makeAdminElement("form", "admin-form");
  const title = document.createElement("input");
  title.type = "text"; title.required = true; title.maxLength = 140; title.placeholder = "Advertisement title";
  const description = document.createElement("textarea");
  description.rows = 3; description.placeholder = "Advertisement description";
  const advertiser = document.createElement("input");
  advertiser.type = "text"; advertiser.placeholder = "Business or advertiser name";
  const website = document.createElement("input");
  website.type = "url"; website.placeholder = "https://business.example (optional)";
  const contact = document.createElement("input");
  contact.type = "text"; contact.placeholder = "Phone, email, or contact link (optional)";
  const category = makeAdminSelect(categoryRows.map(row => ({ value: row.id, label: row.name })), "Choose a category");
  const campaign = document.createElement("select");
  const noCampaign = document.createElement("option"); noCampaign.value = ""; noCampaign.textContent = "No campaign"; campaign.appendChild(noCampaign);
  campaignRows.forEach(row => { const option = document.createElement("option"); option.value = row.id; option.textContent = row.name; campaign.appendChild(option); });
  const video = document.createElement("input");
  video.type = "file"; video.accept = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"; video.required = true;
  const thumbnail = document.createElement("input");
  thumbnail.type = "file"; thumbnail.accept = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"; thumbnail.required = true;
  const status = document.createElement("select");
  [["draft", "Save as draft"], ["published", "Publish now"]].forEach(([value, label]) => { const option = document.createElement("option"); option.value = value; option.textContent = label; status.appendChild(option); });
  const featuredLabel = document.createElement("label"); featuredLabel.className = "admin-check";
  const featured = document.createElement("input"); featured.type = "checkbox";
  featuredLabel.append(featured, document.createTextNode("Show in Featured Ads"));
  const save = makeAdminElement("button", "dialog-button primary", "Upload advertisement");
  save.type = "submit";
  form.append(
    makeAdminField("Title", title), makeAdminField("Description", description),
    makeAdminField("Business name", advertiser), makeAdminField("Website URL", website),
    makeAdminField("Contact information", contact),
    makeAdminField("Category", category), makeAdminField("Campaign", campaign),
    makeAdminField("Video (MP4, WebM, or MOV; max 50 MB)", video),
    makeAdminField("Thumbnail (JPG, PNG, or WebP)", thumbnail),
    makeAdminField("Publication status", status), featuredLabel, save
  );
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const videoFile = video.files?.[0];
    const thumbnailFile = thumbnail.files?.[0];
    const videoTypes = ["video/mp4", "video/webm", "video/quicktime"];
    const imageTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxBytes = 50 * 1024 * 1024;
    if (!videoFile || !thumbnailFile || !videoTypes.includes(videoFile.type) || !imageTypes.includes(thumbnailFile.type)){
      setUploadNotice("Choose a supported video and image file.", true);
      return;
    }
    if (videoFile.size > maxBytes || thumbnailFile.size > maxBytes){
      setUploadNotice("Each file must be 50 MB or smaller for this bucket.", true);
      return;
    }
    save.disabled = true;
    save.textContent = "Uploading…";
    const uploadedPaths = [];
    let adRecordInserted = false;
    let stage = "uploading the video";
    setUploadNotice(`Uploading video (${(videoFile.size / 1024 / 1024).toFixed(1)} MB)…`);
    try {
      const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const extension = file => file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "");
      const videoPath = `ads/${token}/video.${extension(videoFile)}`;
      const thumbnailPath = `ads/${token}/thumbnail.${extension(thumbnailFile)}`;
      const videoUpload = await supabaseClient.storage.from(MEDIA_BUCKET).upload(videoPath, videoFile, { upsert: false, contentType: videoFile.type, cacheControl: "3600" });
      if (videoUpload.error) throw videoUpload.error;
      uploadedPaths.push(videoPath);
      stage = "uploading the thumbnail";
      setUploadNotice("Uploading thumbnail…");
      const imageUpload = await supabaseClient.storage.from(MEDIA_BUCKET).upload(thumbnailPath, thumbnailFile, { upsert: false, contentType: thumbnailFile.type, cacheControl: "3600" });
      if (imageUpload.error) throw imageUpload.error;
      uploadedPaths.push(thumbnailPath);

      const coreRecord = {
        title: title.value.trim(), description: description.value.trim(),
        category_id: category.value, campaign_id: campaign.value || null,
        video_path: videoPath, thumbnail_path: thumbnailPath,
        status: status.value, is_featured: featured.checked
      };
      const extendedRecord = {
        ...coreRecord,
        advertiser_name: advertiser.value.trim() || null,
        website_url: website.value.trim() || null,
        contact_info: contact.value.trim() || null
      };
      stage = "saving the advertisement details";
      setUploadNotice("Saving advertisement details…");
      let result = await supabaseClient.from("ads").insert(extendedRecord);
      if (result.error && ["PGRST204", "42703"].includes(result.error.code)){
        result = await supabaseClient.from("ads").insert(coreRecord);
      }
      if (result.error) throw result.error;
      adRecordInserted = true;
      stage = "confirming the saved advertisement";
      setUploadNotice("Confirming the advertisement was saved…");

      const { data: savedAd, error: verifyError } = await supabaseClient
        .from("ads")
        .select("id,title,status")
        .eq("video_path", videoPath)
        .eq("thumbnail_path", thumbnailPath)
        .maybeSingle();
      if (verifyError) throw new Error(`The ad row was submitted, but AdsMe could not verify it: ${verifyError.message}`);
      if (!savedAd) throw new Error("The media uploaded, but no matching ad row was found in the ads table.");

      await refreshPublicContent();
      setUploadNotice(`Advertisement saved: ${savedAd.title} (${savedAd.status}).`);
      openPageAfterAdminAction("Manage Ads");
    } catch (error){
      const detail = error?.message || String(error);
      const code = error?.code || error?.statusCode;
      const prefix = adRecordInserted
        ? "The ad was submitted, but saving could not be confirmed. Check Manage Ads before another upload."
        : `Upload stopped while ${stage}.`;
      setUploadNotice(`${prefix} ${detail}${code ? ` (Code: ${code})` : ""}`, true);
      console.error("AdsMe upload failed:", error);
      if (!adRecordInserted && uploadedPaths.length){
        try {
          const { error: cleanupError } = await supabaseClient.storage.from(MEDIA_BUCKET).remove(uploadedPaths);
          if (cleanupError) console.warn("Could not clean up incomplete ad media:", cleanupError.message);
        } catch (cleanupError){
          console.warn("Could not clean up incomplete ad media:", cleanupError.message);
        }
      }
    } finally {
      save.disabled = false;
      save.textContent = "Upload advertisement";
    }
  });
  panel.appendChild(form);
}

function openPageAfterAdminAction(label){
  if (!adminInfoDialog?.open) return;
  const button = [...adminInfoDialog._body.querySelectorAll(".admin-tab")].find(item => item.textContent === label);
  button?.click();
}

async function renderAdminManageAds(panel){
  const ads = await getAdminAds();
  if (!ads.length){
    panel.appendChild(makeAdminElement("p", "admin-help", "There are no advertisements yet."));
    return;
  }
  const list = makeAdminElement("div", "admin-list");
  ads.forEach(ad => {
    const row = makeAdminElement("article", "admin-list-row");
    const fields = makeAdminElement("div", "admin-edit-fields");
    const title = document.createElement("input"); title.value = ad.title || ""; title.maxLength = 140; title.setAttribute("aria-label", `Title for ${ad.title || "advertisement"}`);
    const description = document.createElement("textarea"); description.value = ad.description || ""; description.rows = 2; description.setAttribute("aria-label", `Description for ${ad.title || "advertisement"}`);
    const save = makeAdminElement("button", "dialog-button", "Save edits"); save.type = "button";
    save.addEventListener("click", async () => {
      const { error } = await supabaseClient.from("ads").update({ title: title.value.trim(), description: description.value.trim() }).eq("id", ad.id);
      if (error) showToast(`Could not save ad: ${error.message}`);
      else { showToast("Advertisement updated."); await refreshPublicContent(); }
    });
    fields.append(title, description, save);
    const actions = makeAdminElement("div", "admin-row-actions");
    const statusButton = makeAdminElement("button", "dialog-button", ad.status === "published" ? "Unpublish" : "Publish");
    statusButton.type = "button";
    statusButton.addEventListener("click", async () => {
      const nextStatus = ad.status === "published" ? "draft" : "published";
      const { error } = await supabaseClient.from("ads").update({ status: nextStatus }).eq("id", ad.id);
      if (error) showToast(`Could not change publication status: ${error.message}`);
      else { showToast(`Advertisement ${nextStatus === "published" ? "published" : "unpublished"}.`); await refreshPublicContent(); openPageAfterAdminAction("Manage Ads"); }
    });
    const remove = makeAdminElement("button", "dialog-button danger", "Delete");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      if (!window.confirm(`Delete “${ad.title || "this advertisement"}”?`)) return;
      const { error } = await supabaseClient.from("ads").delete().eq("id", ad.id);
      if (error){ showToast(`Could not delete advertisement: ${error.message}`); return; }
      const paths = [ad.video_path, ad.thumbnail_path].filter(Boolean);
      for (const path of paths){
        const [videoRefs, thumbnailRefs] = await Promise.all([
          supabaseClient.from("ads").select("id").eq("video_path", path).limit(1),
          supabaseClient.from("ads").select("id").eq("thumbnail_path", path).limit(1)
        ]);
        const referenceCheckSucceeded = !videoRefs.error && !thumbnailRefs.error;
        const isStillUsed = (videoRefs.data?.length || 0) > 0 || (thumbnailRefs.data?.length || 0) > 0;
        if (referenceCheckSucceeded && !isStillUsed) await supabaseClient.storage.from(MEDIA_BUCKET).remove([path]);
      }
      showToast("Advertisement deleted.");
      await refreshPublicContent();
      openPageAfterAdminAction("Manage Ads");
    });
    actions.append(statusButton, remove);
    row.append(fields, actions);
    list.appendChild(row);
  });
  panel.appendChild(list);
}

async function renderAdminCampaigns(panel){
  const form = makeAdminElement("form", "admin-form campaign-form");
  const name = document.createElement("input"); name.type = "text"; name.required = true; name.maxLength = 120; name.placeholder = "Campaign name";
  const description = document.createElement("textarea"); description.rows = 2; description.placeholder = "Campaign description";
  const status = document.createElement("select");
  [["draft", "Draft"], ["active", "Active"], ["paused", "Paused"], ["completed", "Completed"]].forEach(([value, label]) => { const option = document.createElement("option"); option.value = value; option.textContent = label; status.appendChild(option); });
  const save = makeAdminElement("button", "dialog-button primary", "Create campaign"); save.type = "submit";
  form.append(makeAdminField("Campaign name", name), makeAdminField("Description", description), makeAdminField("Status", status), save);
  form.addEventListener("submit", async event => {
    event.preventDefault(); save.disabled = true;
    const { error } = await supabaseClient.from("campaigns").insert({ name: name.value.trim(), description: description.value.trim(), status: status.value });
    save.disabled = false;
    if (error) showToast(`Campaign could not be created: ${error.message}`);
    else { showToast("Campaign created."); await loadReferenceData(); openPageAfterAdminAction("Campaigns"); }
  });
  panel.appendChild(form);
  const campaigns = await getAdminCampaigns();
  const list = makeAdminElement("div", "admin-list");
  campaigns.forEach(campaign => {
    const row = makeAdminElement("div", "admin-campaign-row");
    row.append(makeAdminElement("strong", "", campaign.name || "Untitled campaign"), makeAdminElement("span", "", campaign.status || "draft"));
    list.appendChild(row);
  });
  panel.appendChild(list);
}

async function renderAdminManagement(panel){
  if (!isSuperAdmin){
    panel.appendChild(makeAdminElement("p", "admin-error", "Only the verified Super Admin can manage Admin access."));
    return;
  }
  const form = makeAdminElement("form", "admin-form admin-grant-form");
  const email = document.createElement("input"); email.type = "email"; email.required = true; email.placeholder = "Google account email (must sign in first)";
  const grant = makeAdminElement("button", "dialog-button primary", "Grant Admin access"); grant.type = "submit";
  form.append(makeAdminField("Registered user's email", email), grant);
  form.addEventListener("submit", async event => {
    event.preventDefault(); grant.disabled = true;
    const { data: profile, error: profileError } = await supabaseClient.from("profiles").select("id,email").eq("email", email.value.trim()).maybeSingle();
    if (profileError || !profile){
      grant.disabled = false;
      showToast(profileError ? `Profile lookup failed: ${profileError.message}` : "That person must sign in with Google once before receiving Admin access.");
      return;
    }
    const { error } = await supabaseClient.rpc("grant_admin", { target_user_id: profile.id });
    grant.disabled = false;
    if (error) showToast(`Could not grant Admin access: ${error.message}`);
    else { email.value = ""; showToast("Admin access granted."); openPageAfterAdminAction("Admin Management"); }
  });
  panel.appendChild(form);

  let rolesResult = await supabaseClient.from("user_roles").select("user_id,role,permission_status,created_at");
  if (rolesResult.error) rolesResult = await supabaseClient.from("user_roles").select("user_id,role");
  if (rolesResult.error){
    panel.appendChild(makeAdminElement("p", "admin-error", `Could not list Admin roles: ${rolesResult.error.message}`));
    return;
  }
  const profilesResult = await supabaseClient.from("profiles").select("id,display_name,email");
  const profilesById = new Map((profilesResult.data || []).map(profile => [profile.id, profile]));
  const list = makeAdminElement("div", "admin-list");
  (rolesResult.data || []).filter(roleRow => normalize(roleRow.role).includes("admin")).forEach(roleRow => {
    const profile = profilesById.get(roleRow.user_id) || {};
    const row = makeAdminElement("div", "admin-campaign-row");
    const identity = profile.email || profile.display_name || roleRow.user_id;
    row.append(makeAdminElement("strong", "", identity), makeAdminElement("span", "", String(roleRow.role || "Admin")));
    const roleText = normalize(roleRow.role);
    if (!roleText.includes("super") && roleRow.user_id !== currentUser.id){
      const revoke = makeAdminElement("button", "dialog-button danger", "Revoke"); revoke.type = "button";
      revoke.addEventListener("click", async () => {
        if (!window.confirm(`Revoke Admin access for ${identity}?`)) return;
        const { error } = await supabaseClient.rpc("revoke_admin", { target_user_id: roleRow.user_id });
        if (error) showToast(`Could not revoke Admin access: ${error.message}`);
        else { showToast("Admin access revoked."); openPageAfterAdminAction("Admin Management"); }
      });
      row.appendChild(revoke);
    }
    list.appendChild(row);
  });
  panel.appendChild(list);
}

async function showAdminDashboardInfo(){
  if (!currentUser){ showToast("Sign in before opening Admin Dashboard."); return; }
  const permission = await readAdminPermissions();
  isSuperAdmin = permission.superAdmin;
  if (!permission.admin){
    accountType = "user";
    renderAccount();
    showToast("This account does not have Admin permission.");
    return;
  }
  accountType = "admin";
  renderAccount();
  try { await loadReferenceData(); }
  catch (error){ showToast(`Could not load dashboard lists: ${error.message}`); }
  renderAdminDashboard();
}

function showAdminChoiceIfNeeded(){
  if (!currentUser) return;
  let choice = "";
  try { choice = sessionStorage.getItem(getChoiceKey(currentUser.id)) || ""; } catch {}
  if (choice === "normal"){
    accountType = "user";
    renderAccount();
    return;
  }
  if (choice === "admin" && (isSuperAdmin || accountType === "admin")){
    accountType = "admin";
    renderAccount();
    return;
  }
  showAdminChoice();
}

async function applySession(session, event){
  const previousUserId = currentUser?.id;
  currentSession = session;
  currentUser = session?.user || null;
  if (!currentUser || previousUserId !== currentUser.id){
    uploadNoticeState = null;
    renderUploadNotice();
  }
  isSuperAdmin = false;
  if (!currentUser){
    if (previousUserId){
      try { sessionStorage.removeItem(getChoiceKey(previousUserId)); } catch {}
    }
    accountType = "visitor";
    renderAccount();
    return;
  }

  // Check roles with backend functions; an email or browser-side value never grants Admin access.
  const permission = await readAdminPermissions();
  isSuperAdmin = permission.superAdmin;
  let savedChoice = "";
  try { savedChoice = sessionStorage.getItem(getChoiceKey(currentUser.id)) || ""; } catch {}
  accountType = permission.admin && savedChoice === "admin" ? "admin" : "user";
  renderAccount();
  if (event === "SIGNED_IN" || event === "INITIAL_SESSION") showAdminChoiceIfNeeded();
}

async function handleGoogleSignIn(){
  if (currentUser){
    showProfile();
    return;
  }
  if (!supabaseClient){
    showToast("Supabase did not initialize. Check that the Supabase script loaded.");
    return;
  }
  if (!["http:", "https:"].includes(window.location.protocol)){
    showToast("Google sign-in needs an http(s) website address. It cannot complete from a file opened directly.");
    return;
  }
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo }
  });
  if (error) showToast(`Google sign-in could not start: ${error.message}`);
}

googleSignIn.addEventListener("click", handleGoogleSignIn);
thirdTab.addEventListener("click", event => {
  event.preventDefault();
  if (accountType === "visitor") handleGoogleSignIn();
  else if (accountType === "admin") showAdminDashboardInfo();
  else showProfile();
});

if (supabaseClient){
  // Supabase processes the OAuth redirect and restores the session through this listener.
  supabaseClient.auth.onAuthStateChange((event, session) => {
    window.setTimeout(() => { void applySession(session, event); }, 0);
  });
} else {
  renderAccount();
}

// Bottom navigation highlight
const navItems = $$(".nav-item[data-nav]");
const sections = ["home", "explore"].map(id => document.getElementById(id));
window.addEventListener("scroll", () => {
  let current = "home";
  sections.forEach(section => {
    if (section.getBoundingClientRect().top < window.innerHeight * 0.4) current = section.id;
  });
  navItems.forEach(item => item.classList.toggle("on", item.dataset.nav === current));
});

updateSearchResults();
void refreshPublicContent();
