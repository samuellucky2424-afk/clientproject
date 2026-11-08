import { loadFeatures } from "./admin-features.js";
import "@coreui/coreui/dist/css/coreui.min.css";
import "./admin.css";
import { apiJson, setupAccount } from "./session.js";
const $ = (id) => document.getElementById(id),
  money = (n) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n),
  date = (s) => (s ? new Date(s).toLocaleDateString() : "Never");
let userPage = 1,
  activityPage = 1;
const el = (tag, text, className) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (className) n.className = className;
  return n;
};
function row(values) {
  const tr = el("tr");
  for (const v of values) tr.append(el("td", v));
  return tr;
}
async function users() {
  const data = await apiJson(`/api/admin/users?page=${userPage}`);
  $("userList").replaceChildren();
  for (const u of data.users) {
    const tr = row([
      u.email,
      date(u.created_at),
      money(u.balance),
      u.last_sign_in_at &&
      Date.now() - Date.parse(u.last_sign_in_at) < 30 * 86400000
        ? "Active"
        : "Inactive",
      u.referrals,
    ]);
    tr.firstChild.append(el("small", u.id));
    tr.children[3].append(el("small", `Account: ${u.account_state}`));
    const actions = el("td");
    for (const [label, type] of [
      ["Manage access", "status"],
      ["Top up", "credit"],
    ]) {
      const b = el("button", label, "btn btn-sm btn-outline-primary m-1");
      b.onclick = () => openManage(u, type);
      actions.append(b);
    }
    tr.append(actions);
    $("userList").append(tr);
  }
  if (!data.users.length) $("userList").append(row(["No users on this page."]));
  $("userPage").textContent = `Page ${userPage}`;
  $("prevUsers").disabled = userPage === 1;
  $("nextUsers").disabled = data.users.length < 50;
}
async function activity() {
  const data = await apiJson(`/api/admin/activity?page=${activityPage}`);
  $("requestList").replaceChildren();
  for (const r of data.requests) {
    const card = el("article", undefined, "request");
    card.append(
      el("h3", r.title, "h6"),
      el("small", `${r.user_id} ? ${date(r.created_at)} ? ${r.contact}`),
      el("p", r.details),
      el(
        "p",
        `${r.full_name || "Legacy request"} | Email: ${r.email || r.contact} | WhatsApp: ${r.whatsapp || r.contact} | Fee: ${r.fee_cents ? money(r.fee_cents / 100) : "Legacy request - no fee"}`,
      ),
    );
    const form = el("form"),
      select = el("select", undefined, "form-select"),
      note = el("textarea", undefined, "form-control"),
      button = el("button", "Save status", "btn btn-primary");
    select.setAttribute("aria-label", "Request status");
    for (const state of ["pending", "accepted", "completed", "declined"]) {
      const option = el("option", state);
      option.value = state;
      select.append(option);
    }
    select.value = r.state;
    note.value = r.admin_note;
    note.maxLength = 1000;
    note.placeholder = "Note visible to the user";
    note.setAttribute("aria-label", "Note visible to the user");
    form.append(select, note, button);
    form.onsubmit = async (e) => {
      e.preventDefault();
      button.disabled = true;
      try {
        await apiJson("/api/admin/requests/update", {
          id: r.id,
          state: select.value,
          note: note.value,
        });
        $("message").textContent = "Request updated.";
        await overview();
      } catch (error) {
        $("message").textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
    card.append(form);
    $("requestList").append(card);
  }
  if (!data.requests.length)
    $("requestList").textContent = "No V2V requests on this page.";
  $("transactionList").replaceChildren();
  for (const t of data.transfers) {
    const tr = row([
      t.id,
      `${t.platform} preview`,
      `${t.amount} ${t.coin}`,
      money(t.fee),
      t.state,
    ]);
    tr.firstChild.className = "reference";
    $("transactionList").append(tr);
  }
  for (const d of data.deposits) {
    const tr = row([
      d.reference,
      "Wallet deposit",
      `NGN ${d.ngnAmount.toFixed(2)}`,
      money(d.usdCredit),
      d.state,
    ]);
    tr.firstChild.className = "reference";
    $("transactionList").append(tr);
  }
  for (const c of data.credits) {
    const tr = row([
      c.id,
      "Admin wallet credit",
      money(c.amount_cents / 100),
      c.reason,
      `By ${c.admin_id}`,
    ]);
    tr.firstChild.className = "reference";
    $("transactionList").append(tr);
  }
  if (!data.transfers.length && !data.deposits.length && !data.credits.length)
    $("transactionList").append(row(["No transactions on this page."]));
  $("referralList").replaceChildren();
  for (const r of data.referrals)
    $("referralList").append(
      el(
        "p",
        `${r.referrer_id} ? ${r.user_id} ? ${date(r.created_at)}`,
        "reference",
      ),
    );
  if (!data.referrals.length)
    $("referralList").textContent = "No referrals on this page.";
  $("activityPage").textContent = `Activity page ${activityPage}`;
  $("prevActivity").disabled = activityPage === 1;
  $("nextActivity").disabled =
    Math.max(
      data.requests.length,
      data.transfers.length,
      data.deposits.length,
      data.referrals.length,
      data.credits.length,
    ) < 50;
}
async function overview() {
  const d = await apiJson("/api/admin/overview");
  $("overview").replaceChildren();
  for (const [label, value, hint] of [
    ["User wallet balances", money(d.balance), "Total customer credits ? USD"],
    ["Revenue", money(d.revenue), "Service fees less refunds ? USD"],
    ["Transactions", d.transactions, "Confirmed fictional transfers"],
    ["Active users", d.activeUsers, "Signed in within 30 days"],
    ["Registered users", d.users, "All non-anonymous accounts"],
    ["Verified deposits", money(d.deposits), "Wallet funding ? USD equivalent"],
    ["Referrals", d.referrals, "Recorded referred accounts"],
    [
      "Pending V2V requests",
      d.pendingRequests,
      "Awaiting administrator review",
    ],
  ]) {
    const card = el("article", undefined, "metric");
    card.append(
      el("span", label),
      el("strong", String(value)),
      el("small", hint),
    );
    $("overview").append(card);
  }
  const max = Math.max(1, ...d.daily.map((x) => Number(x.revenue)));
  $("chart").replaceChildren();
  for (const day of d.daily) {
    const col = el("div", undefined, "chart-column"),
      bar = el("div", undefined, "chart-bar");
    bar.style.height = `${Math.max(1, (Number(day.revenue) / max) * 155)}px`;
    bar.title = `${day.day}: ${money(day.revenue)}`;
    col.append(
      el("span", money(day.revenue)),
      bar,
      el("span", day.day.slice(5)),
    );
    $("chart").append(col);
  }
}
async function refresh() {
  $("refresh").disabled = true;
  try {
    await Promise.all([overview(), users(), activity(), loadFeatures()]);
    $("adminContent").hidden = false;
    $("message").textContent = "";
    $("updated").textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    $("message").textContent = error.message;
  } finally {
    $("refresh").disabled = false;
  }
}
$("refresh").onclick = refresh;
for (const [id, change, load] of [
  ["prevUsers", -1, users],
  ["nextUsers", 1, users],
  ["prevActivity", -1, activity],
  ["nextActivity", 1, activity],
])
  $(id).onclick = async () => {
    if (id.includes("Users")) userPage += change;
    else activityPage += change;
    try {
      await load();
    } catch (error) {
      $("message").textContent = error.message;
    }
  };
$("menu").onclick = () => {
  const open = document
    .querySelector(".admin-sidebar")
    .classList.toggle("open");
  $("menu").setAttribute("aria-expanded", String(open));
};
document.querySelectorAll(".admin-sidebar a").forEach((a) =>
  a.addEventListener("click", () => {
    document.querySelector(".admin-sidebar").classList.remove("open");
    $("menu").setAttribute("aria-expanded", "false");
  }),
);
try {
  await setupAccount();
  const account = await apiJson("/api/account");
  if (!account.admin)
    throw Error(
      "Administrator access required. Sign in with an administrator account.",
    );
  await refresh();
} catch (error) {
  $("message").textContent = error.message;
}

let selectedUser, manageType, creditKey;
function openManage(user, type) {
  selectedUser = user;
  manageType = type;
  creditKey = crypto.randomUUID();
  $("manageTitle").textContent =
    type === "credit" ? "Top up user wallet" : "Manage account access";
  $("manageDetails").textContent =
    `${user.email} | ${user.id} | Balance: ${money(user.balance)}`;
  $("statusField").hidden = type === "credit";
  $("creditField").hidden = type !== "credit";
  $("creditAmount").required = type === "credit";
  $("creditAmount").value = "";
  $("accountState").value = user.account_state;
  $("manageReason").value = "";
  $("manageError").textContent = "";
  $("saveManage").textContent =
    type === "credit" ? "Confirm wallet top-up" : "Save account status";
  $("manageUser").showModal();
}
$("cancelManage").onclick = () => $("manageUser").close();
for (const id of ["creditAmount", "manageReason"])
  $(id).addEventListener("input", () => (creditKey = crypto.randomUUID()));
$("manageForm").onsubmit = async (e) => {
  e.preventDefault();
  $("saveManage").disabled = true;
  $("cancelManage").disabled = true;
  try {
    if (manageType === "credit")
      await apiJson("/api/admin/users/credit", {
        userId: selectedUser.id,
        requestKey: creditKey,
        amount: $("creditAmount").value,
        reason: $("manageReason").value,
      });
    else
      await apiJson("/api/admin/users/status", {
        userId: selectedUser.id,
        state: $("accountState").value,
        reason: $("manageReason").value,
      });
    $("manageUser").close();
    await refresh();
    $("message").textContent =
      manageType === "credit"
        ? "Wallet credited and recorded in the audit history."
        : "Account status updated.";
  } catch (error) {
    $("manageError").textContent = error.message;
  } finally {
    $("saveManage").disabled = false;
    $("cancelManage").disabled = false;
  }
};
$("manageUser").addEventListener("cancel", (e) => {
  if ($("saveManage").disabled) e.preventDefault();
});
