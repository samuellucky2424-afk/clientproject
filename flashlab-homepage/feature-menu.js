import { apiJson } from "./session.js";
const $ = (id) => document.getElementById(id);
export function setupFeatureMenu({ openVideo, topUp }) {
  const menu = $("featureMenu");
  let closingTimer;
  const builtins = new Map(
    [...document.querySelectorAll("[data-feature-slug]")].map((card) => [
      card.dataset.featureSlug,
      card.cloneNode(true),
    ]),
  );
  const defaults = [
    {
      id: "crypto",
      slug: "crypto",
      title: "Crypto flash prank",
      description: "Create a fictional crypto transfer preview.",
      action: "crypto",
      sort_order: 10,
    },
    {
      id: "video",
      slug: "video",
      title: "V2V prank",
      description: "Request a video call prank.",
      action: "video",
      sort_order: 30,
      fee_cents: null,
    },
  ];
  function close(after) {
    if (!menu.open) {
      after?.();
      return;
    }
    menu.classList.add("closing");
    clearTimeout(closingTimer);
    closingTimer = setTimeout(
      () => {
        menu.close();
        menu.classList.remove("closing");
        $("openFeatureMenu").setAttribute("aria-expanded", "false");
        after?.();
      },
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180,
    );
  }
  function activate(feature) {
    close(() => {
      if (feature.action === "crypto") location.assign("/crypto");
      else if (feature.action === "video") void openVideo();
      else if (feature.action === "link") location.assign(feature.url);
      else {
        $("featureDetailsTitle").textContent = feature.title;
        $("featureDetailsText").textContent = feature.description;
        $("featureDetails").showModal();
      }
    });
  }
  function render(features) {
    features.sort(
      (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
    );
    $("featureCards").replaceChildren();
    $("featureMenuLinks").replaceChildren();
    for (const f of features) {
      const nav = document.createElement("button");
      nav.type = "button";
      nav.textContent = f.title;
      nav.onclick = () => activate(f);
      $("featureMenuLinks").append(nav);
      const original = builtins.get(f.slug);
      if (original) {
        const card = original.cloneNode(true);
        card.querySelector("h3").textContent = f.title;
        card.querySelector("p").textContent = f.description;
        card.onclick = () => activate(f);
        $("featureCards").append(card);
        continue;
      }
      const card = document.createElement("button");
      card.type = "button";
      card.className = "prank-card dynamic-feature";
      const letter = document.createElement("span"),
        title = document.createElement("h3"),
        description = document.createElement("p"),
        action = document.createElement("span");
      letter.className = "feature-letter";
      letter.textContent = f.title.slice(0, 1).toUpperCase();
      title.textContent = f.title;
      description.textContent = f.description;
      action.className = "card-footer";
      action.textContent =
        f.action === "video"
          ? f.fee_cents === null
            ? "Fee not set yet"
            : `Request a call - $${(f.fee_cents / 100).toFixed(2)} USD`
          : "Explore feature";
      card.append(letter, title, description, action);
      card.onclick = () => activate(f);
      $("featureCards").append(card);
    }
  }
  async function load() {
    try {
      const { features } = await apiJson("/api/features");
      render(features);
      $("featureLoadMessage").textContent = features.length
        ? ""
        : "No features are currently available.";
      $("featureMenuMessage").textContent = "";
    } catch (error) {
      $("featureLoadMessage").textContent =
        "Live feature updates are temporarily unavailable. You can still explore the services below.";
      $("featureMenuMessage").textContent =
        "Live feature updates are temporarily unavailable.";
    }
  }
  $("openFeatureMenu").onclick = () => {
    clearTimeout(closingTimer);
    menu.classList.remove("closing");
    menu.showModal();
    $("openFeatureMenu").setAttribute("aria-expanded", "true");
    void load();
  };
  $("closeFeatureMenu").onclick = () => close();
  menu.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  menu.addEventListener("click", (event) => {
    const r = menu.getBoundingClientRect();
    if (
      event.target === menu &&
      (event.clientX > r.right ||
        event.clientY > r.bottom ||
        event.clientX < r.left ||
        event.clientY < r.top)
    )
      close();
  });
  menu
    .querySelectorAll("a")
    .forEach((a) => a.addEventListener("click", () => close()));
  $("menuWallet").onclick = () => close(topUp);
  for (const b of $("featureDetails").querySelectorAll("button"))
    b.onclick = () => $("featureDetails").close();
  render(defaults);
  void load();
  window.addEventListener("pageshow", () => void load());
}
