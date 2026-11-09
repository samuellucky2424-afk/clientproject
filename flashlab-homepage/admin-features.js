import { apiJson } from "./session.js";
const $ = (id) => document.getElementById(id);
let features = [];
function fields() {
  const action = $("featureAction").value;
  $("featureUrlField").hidden = action !== "link";
  $("featureUrl").required = action === "link";
  $("featureFeeField").hidden = action !== "video";
  $("featurePercentField").hidden = action !== "crypto";
}
function reset() {
  $("featureForm").reset();
  $("featureId").value = "";
  $("featureAction").disabled = false;
  $("featureFormTitle").textContent = "Add a feature";
  fields();
}
export async function loadFeatures() {
  const data = await apiJson("/api/admin/features");
  features = data.features.sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );
  $("featureList").replaceChildren();
  for (const f of features) {
    const row = document.createElement("article");
    row.className = "feature-row";
    const title = document.createElement("strong"),
      copy = document.createElement("p"),
      edit = document.createElement("button");
    title.textContent = `${f.title} | ${f.enabled ? "Visible" : "Hidden"} | Order ${f.sort_order}`;
    copy.textContent =
      f.action === "video"
        ? `V2V fee: ${f.fee_cents === null ? "Not set - requests paused" : "$" + (f.fee_cents / 100).toFixed(2)}`
        : f.action === "crypto" ? `Transaction fee: ${f.fee_percent ?? 1}%` : f.description;
    edit.textContent = "Edit";
    edit.className = "btn btn-sm btn-outline-primary";
    edit.type = "button";
    edit.onclick = () => {
      $("featureId").value = f.id;
      $("featureTitle").value = f.title;
      $("featureDescription").value = f.description;
      $("featureAction").value = f.action;
      $("featureAction").disabled = ["crypto", "video", "new-phone"].includes(
        f.slug,
      );
      $("featureUrl").value = f.url;
      $("featureFee").value =
        f.fee_cents === null ? "" : (f.fee_cents / 100).toFixed(2);
      $("featurePercent").value = f.fee_percent ?? 1;
      $("featureOrder").value = f.sort_order;
      $("featureEnabled").checked = f.enabled;
      $("featureFormTitle").textContent = `Edit ${f.title}`;
      $("featureMessage").textContent = "";
      fields();
      $("featureForm").scrollIntoView({ block: "center", behavior: "smooth" });
    };
    row.append(title, copy, edit);
    $("featureList").append(row);
  }
}
$("featureAction").onchange = fields;
$("resetFeature").onclick = reset;
$("featureForm").onsubmit = async (e) => {
  e.preventDefault();
  $("saveFeature").disabled = true;
  try {
    await apiJson("/api/admin/features/save", {
      id: $("featureId").value || undefined,
      title: $("featureTitle").value,
      description: $("featureDescription").value,
      action: $("featureAction").value,
      url: $("featureUrl").value,
      fee: $("featureFee").value,
      feePercent: Number($("featurePercent").value),
      sortOrder: Number($("featureOrder").value),
      enabled: $("featureEnabled").checked,
    });
    reset();
    await loadFeatures();
    $("featureMessage").textContent =
      "Saved. Users will see the updated menu and cards when they refresh or reopen the menu.";
  } catch (error) {
    $("featureMessage").textContent = error.message;
  } finally {
    $("saveFeature").disabled = false;
  }
};
