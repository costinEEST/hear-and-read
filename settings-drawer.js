// Keep controls mounted so closing preserves drafts and localization bindings.
export function initSettingsDrawer({
  root = document,
  beforeOpen = () => {},
} = {}) {
  const drawer = root.getElementById("settings-drawer");
  const triggers = root.querySelectorAll('[aria-controls="settings-drawer"]');
  const setExpanded = (expanded) => {
    for (const trigger of triggers)
      trigger.setAttribute("aria-expanded", String(expanded));
  };
  for (const trigger of triggers) {
    trigger.addEventListener("click", () => {
      if (drawer.open) return;
      beforeOpen();
      const section = root.getElementById(trigger.dataset.settingsSection);
      if (section) section.open = true;
      drawer.showModal();
      setExpanded(true);
      if (section)
        section.querySelector("summary").scrollIntoView({ block: "nearest" });
    });
  }
  drawer.addEventListener("close", () => setExpanded(false));
  // Safari fallback: the same gesture must start and end outside the panel.
  if (!("closedBy" in drawer)) {
    const outside = (event) => {
      const rect = drawer.getBoundingClientRect();
      return (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      );
    };
    let outsidePointer = null;
    drawer.addEventListener("pointerdown", (event) => {
      outsidePointer = outside(event) ? event.pointerId : null;
    });
    drawer.addEventListener("pointerup", (event) => {
      if (outsidePointer === event.pointerId && outside(event)) drawer.close();
      outsidePointer = null;
    });
    drawer.addEventListener("pointercancel", () => {
      outsidePointer = null;
    });
  }
}
