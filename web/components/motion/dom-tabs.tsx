"use client";

import { animate } from "motion";
import { useEffect } from "react";

type DomTabsProps = {
  /** Element ids of the tab buttons, in order. */
  buttonIds: readonly string[];
  /** Element ids of the panels, in the same order. */
  panelIds: readonly string[];
  /** Classes a button wears while selected / not selected (the whole class list, as the mockup sets it). */
  activeClass: string;
  inactiveClass: string;
  /** An optional badge inside each button, with its own selected / not selected classes. */
  badgeSelector?: string;
  badgeActiveClass?: string;
  badgeInactiveClass?: string;
  /** The tab selected on load. */
  initial?: number;
  /** Any element with `data-tab-to="N"` (a Next or Previous button, say) also selects tab `N - triggerBase`. */
  triggerBase?: number;
  /** When a panel was chosen from far away, scroll this element into view (the mockup's behaviour). */
  scrollToId?: string;
};

/**
 * Makes a row of tab buttons and their panels, already in the page, switch panels. It renders nothing: the buttons and
 * panels are the markup of the owner's mockup, and this attaches the behaviour the mockup's script had. A newly shown
 * panel eases in with Motion. Keyboard: the buttons are real buttons, so Enter and Space work.
 */
export function DomTabs({ buttonIds, panelIds, activeClass, inactiveClass, badgeSelector, badgeActiveClass, badgeInactiveClass, initial = 0, triggerBase = 0, scrollToId }: DomTabsProps) {
  useEffect(() => {
    const buttons = buttonIds.map((id) => document.getElementById(id));
    const panels = panelIds.map((id) => document.getElementById(id));

    function select(index: number, animateIn: boolean) {
      buttons.forEach((button, i) => {
        if (!button) return;
        const isActive = i === index;
        button.className = isActive ? activeClass : inactiveClass;
        button.setAttribute("aria-selected", String(isActive));
        const badge = badgeSelector ? button.querySelector<HTMLElement>(badgeSelector) : null;
        if (badge && badgeActiveClass && badgeInactiveClass) badge.className = isActive ? badgeActiveClass : badgeInactiveClass;
      });
      panels.forEach((panel, i) => {
        if (!panel) return;
        const isActive = i === index;
        panel.classList.toggle("hidden", !isActive);
        if (isActive && animateIn) animate(panel, { opacity: [0, 1], y: [10, 0] }, { duration: 0.35, ease: [0.16, 1, 0.3, 1] });
      });
      const active = panels[index];
      if (animateIn && active && scrollToId) {
        const rect = active.getBoundingClientRect();
        if (rect.top < 80 || rect.bottom > window.innerHeight + 200) document.getElementById(scrollToId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    const handlers = buttons.map((button, i) => {
      const handle = () => select(i, true);
      button?.addEventListener("click", handle);
      return handle;
    });
    const triggers = [...document.querySelectorAll<HTMLElement>("[data-tab-to]")].filter((element) => !buttons.includes(element));
    const triggerHandlers = triggers.map((element) => {
      const handle = () => select(Number(element.dataset.tabTo) - triggerBase, true);
      element.addEventListener("click", handle);
      return handle;
    });
    select(initial, false);
    return () => {
      buttons.forEach((button, i) => button?.removeEventListener("click", handlers[i]));
      triggers.forEach((element, i) => element.removeEventListener("click", triggerHandlers[i]));
    };
  }, [buttonIds, panelIds, activeClass, inactiveClass, badgeSelector, badgeActiveClass, badgeInactiveClass, initial, triggerBase, scrollToId]);

  return null;
}
