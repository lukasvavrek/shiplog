import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(req.url);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://shiplog.app";

  // Read config from query params (allows overriding script-tag data attributes)
  const theme = url.searchParams.get("theme") ?? "light";
  const maxEntries = Math.min(
    Number(url.searchParams.get("max") ?? "5"),
    20
  );

  // Determine branding: hide for Pro/Team owners
  let showBranding = true;
  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, slug),
  });
  if (project) {
    const owner = await db.query.users.findFirst({
      where: eq(users.id, project.userId),
    });
    showBranding = !owner || owner.plan === "free";
  }

  const js = buildWidgetScript(appUrl, slug, theme, maxEntries, showBranding);

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function buildWidgetScript(
  appUrl: string,
  slug: string,
  defaultTheme: string,
  defaultMax: number,
  showBranding: boolean
): string {
  return `(function () {
  var SCRIPT = document.currentScript;
  var theme = (SCRIPT && SCRIPT.getAttribute('data-theme')) || '${defaultTheme}';
  var maxEntries = parseInt((SCRIPT && SCRIPT.getAttribute('data-max')) || '${defaultMax}', 10);
  var showTitle = (SCRIPT && SCRIPT.getAttribute('data-show-title')) !== 'false';
  var container = SCRIPT && document.getElementById(SCRIPT.getAttribute('data-target'));
  if (!container) {
    container = document.createElement('div');
    if (SCRIPT && SCRIPT.parentNode) {
      SCRIPT.parentNode.insertBefore(container, SCRIPT.nextSibling);
    } else {
      document.body.appendChild(container);
    }
  }

  var isDark = theme === 'dark';
  var styles = [
    '.sl-widget { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.5; }',
    '.sl-widget * { box-sizing: border-box; }',
    '.sl-widget-inner { border: 1px solid ' + (isDark ? '#2d2d2d' : '#e5e7eb') + '; border-radius: 10px; overflow: hidden; background: ' + (isDark ? '#1a1a1a' : '#fff') + '; color: ' + (isDark ? '#e5e7eb' : '#111827') + '; }',
    '.sl-widget-header { padding: 12px 16px; border-bottom: 1px solid ' + (isDark ? '#2d2d2d' : '#f3f4f6') + '; }',
    '.sl-widget-title { margin: 0; font-size: 13px; font-weight: 600; color: ' + (isDark ? '#9ca3af' : '#6b7280') + '; text-transform: uppercase; letter-spacing: 0.05em; }',
    '.sl-widget-list { list-style: none; margin: 0; padding: 0; }',
    '.sl-widget-item { padding: 14px 16px; border-bottom: 1px solid ' + (isDark ? '#2d2d2d' : '#f3f4f6') + '; }',
    '.sl-widget-item:last-child { border-bottom: none; }',
    '.sl-widget-item-title { font-weight: 600; font-size: 14px; margin: 0 0 2px; }',
    '.sl-widget-item-date { font-size: 12px; color: ' + (isDark ? '#6b7280' : '#9ca3af') + '; margin: 0 0 6px; }',
    '.sl-widget-item-content { font-size: 13px; color: ' + (isDark ? '#d1d5db' : '#374151') + '; margin: 0; white-space: pre-wrap; }',
    '.sl-widget-footer { padding: 10px 16px; border-top: 1px solid ' + (isDark ? '#2d2d2d' : '#f3f4f6') + '; text-align: center; }',
    '.sl-widget-footer a { font-size: 11px; color: ' + (isDark ? '#6b7280' : '#9ca3af') + '; text-decoration: none; }',
    '.sl-widget-footer a:hover { color: ' + (isDark ? '#9ca3af' : '#6b7280') + '; }',
    '.sl-widget-empty { padding: 24px 16px; text-align: center; color: ' + (isDark ? '#6b7280' : '#9ca3af') + '; font-size: 13px; }',
  ].join('\\n');

  var styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  var apiUrl = '${appUrl}/api/changelog/${slug}/entries?limit=' + maxEntries;

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return iso; }
  }

  function stripMarkdown(text) {
    return text
      .replace(/^#+\\s+/gm, '')
      .replace(/\\*\\*(.+?)\\*\\*/g, '$1')
      .replace(/\\*(.+?)\\*/g, '$1')
      .replace(/^[-*]\\s+/gm, '• ')
      .trim();
  }

  function render(data) {
    var inner = document.createElement('div');
    inner.className = 'sl-widget-inner';

    if (showTitle) {
      var header = document.createElement('div');
      header.className = 'sl-widget-header';
      var titleEl = document.createElement('p');
      titleEl.className = 'sl-widget-title';
      titleEl.textContent = (data.project && data.project.name ? data.project.name + ' ' : '') + 'Changelog';
      header.appendChild(titleEl);
      inner.appendChild(header);
    }

    var entries = data.entries || [];
    if (entries.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'sl-widget-empty';
      empty.textContent = 'No updates yet.';
      inner.appendChild(empty);
    } else {
      var list = document.createElement('ul');
      list.className = 'sl-widget-list';
      entries.forEach(function (entry) {
        var item = document.createElement('li');
        item.className = 'sl-widget-item';
        var title = document.createElement('p');
        title.className = 'sl-widget-item-title';
        title.textContent = entry.title;
        var date = document.createElement('p');
        date.className = 'sl-widget-item-date';
        date.textContent = formatDate(entry.publishedAt);
        var content = document.createElement('p');
        content.className = 'sl-widget-item-content';
        content.textContent = stripMarkdown(entry.content);
        item.appendChild(title);
        item.appendChild(date);
        item.appendChild(content);
        list.appendChild(item);
      });
      inner.appendChild(list);
    }

    if (${showBranding}) {
      var footer = document.createElement('div');
      footer.className = 'sl-widget-footer';
      var link = document.createElement('a');
      link.href = '${appUrl}/${slug}';
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Powered by ShipLog';
      footer.appendChild(link);
      inner.appendChild(footer);
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'sl-widget';
    wrapper.appendChild(inner);
    container.innerHTML = '';
    container.appendChild(wrapper);
  }

  var xhr = new XMLHttpRequest();
  xhr.open('GET', apiUrl);
  xhr.onload = function () {
    if (xhr.status === 200) {
      try { render(JSON.parse(xhr.responseText)); } catch (e) {}
    }
  };
  xhr.send();
})();`;
}
