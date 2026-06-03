#!/usr/bin/env python3
"""Generate 24 institutional PNG assets for NRCS SEIP investor presentation."""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, Rectangle, Circle, Polygon, FancyArrowPatch
import numpy as np

# Output directory (Windows + Linux)
OUTPUT_DIR = Path("C:/mnt/agents/output")
if not OUTPUT_DIR.exists():
    alt = Path("/mnt/agents/output")
    if alt.exists() or str(alt).startswith("/"):
        try:
            alt.mkdir(parents=True, exist_ok=True)
            OUTPUT_DIR = alt
        except OSError:
            pass
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Design system
C = {
    "red": "#E31837",
    "blue": "#002855",
    "white": "#FFFFFF",
    "charcoal": "#36454F",
    "black": "#000000",
    "gold": "#D4AF37",
    "slate": "#708090",
    "light_blue": "#E6F3FF",
    "light_gray": "#F5F5F5",
    "medium_gray": "#D3D3D3",
    "lodge": "#4A90E2",
    "donors": "#7ED321",
    "relationships": "#F5A623",
    "sdg17": "#9013FE",
}

FOOTER = "STRICTLY PRIVATE AND CONFIDENTIAL | NRCS SEIP | May 2026"
DPI = 300
FIGSIZE = (16, 9)


def new_fig():
    fig, ax = plt.subplots(figsize=FIGSIZE, dpi=DPI)
    ax.set_xlim(0, 16)
    ax.set_ylim(0, 9)
    ax.set_aspect("equal")
    ax.axis("off")
    fig.patch.set_facecolor(C["white"])
    return fig, ax


def add_footer(ax):
    ax.text(15.9, 0.25, FOOTER, fontsize=8, color=C["slate"], ha="right", va="bottom",
            fontfamily="DejaVu Sans")


def save_asset(fig, name):
    path = OUTPUT_DIR / name
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor=fig.get_facecolor(), pad_inches=0.1)
    plt.close(fig)
    print(f"  Saved: {name}")


def rounded_box(ax, x, y, w, h, color, alpha=1.0, ec=None, lw=1):
    box = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.15",
                         facecolor=color, edgecolor=ec or color, linewidth=lw, alpha=alpha)
    ax.add_patch(box)
    return box


def asset_01():
    fig, ax = new_fig()
    ax.text(8, 6.2, "Ambulance Coverage Deficit", fontsize=28, ha="center", color=C["blue"], fontweight="bold")
    ax.text(4.5, 4.5, "0.4", fontsize=120, ha="center", color=C["red"], fontweight="bold")
    ax.text(4.5, 3.6, "Nigeria (per 100K)", fontsize=14, ha="center", color=C["charcoal"])
    ax.text(11.5, 4.5, "1.0", fontsize=120, ha="center", color=C["blue"], fontweight="bold")
    ax.text(11.5, 3.6, "WHO Benchmark", fontsize=14, ha="center", color=C["charcoal"])
    rounded_box(ax, 5.5, 2.2, 5, 0.9, C["red"])
    ax.text(8, 2.65, "96% DEFICIT vs WHO Standard", fontsize=18, ha="center", color=C["white"], fontweight="bold")
    strip = Rectangle((0, 1.0), 16, 0.8, facecolor=C["blue"])
    ax.add_patch(strip)
    ax.text(3, 1.4, "7% of population served", fontsize=13, ha="center", color=C["white"])
    ax.text(8, 1.4, "2.2–4.4M lives at risk annually", fontsize=13, ha="center", color=C["white"])
    ax.text(13, 1.4, "Emergency response gap", fontsize=13, ha="center", color=C["white"])
    add_footer(ax)
    save_asset(fig, "01_hero_ambulance_deficit.png")


def asset_02():
    fig, ax = new_fig()
    ax.add_patch(Rectangle((0, 7.5), 16, 1.5, facecolor=C["blue"]))
    ax.add_patch(Circle((1.5, 8.25), 0.45, facecolor=C["red"]))
    ax.add_patch(Rectangle((1.2, 7.95), 0.6, 0.3, facecolor=C["white"]))
    ax.text(8, 8.25, "NIGERIAN RED CROSS SOCIETY", fontsize=22, ha="center", color=C["white"], fontweight="bold")
    ax.text(8, 5.8, "SOCIAL ENTERPRISE\nINFRASTRUCTURE PLATFORM", fontsize=32, ha="center", color=C["blue"], fontweight="bold")
    rounded_box(ax, 2, 3.2, 12, 2.0, C["light_blue"])
    ax.text(8, 4.5, "Investment Thesis", fontsize=16, ha="center", color=C["blue"], fontweight="bold")
    ax.text(8, 3.8, "Self-sustaining humanitarian infrastructure via 4 revenue verticals", fontsize=12, ha="center", color=C["charcoal"])
    metrics = [("CHF 750K", "Total Ask"), ("CHF 637K", "Capex"), ("79%", "Grant Util."), ("12%", "Mission Dividend")]
    for i, (val, lbl) in enumerate(metrics):
        x = 2.5 + i * 3.5
        rounded_box(ax, x - 1, 1.5, 2.8, 1.2, C["light_gray"])
        ax.text(x + 0.4, 2.2, val, fontsize=20, ha="center", color=C["red"], fontweight="bold")
        ax.text(x + 0.4, 1.7, lbl, fontsize=10, ha="center", color=C["charcoal"])
    bar = Rectangle((0, 0.5), 16, 0.6, facecolor=C["blue"])
    ax.add_patch(bar)
    ax.text(8, 0.8, "NSIA Strategic Partnership | May 2026 | Strictly Confidential", fontsize=11, ha="center", color=C["white"])
    add_footer(ax)
    save_asset(fig, "02_title_slide.png")


def asset_03():
    fig, ax = new_fig()
    ax.text(8, 8.2, "NRCS SEIP Flywheel", fontsize=26, ha="center", color=C["blue"], fontweight="bold")
    ax.add_patch(Circle((8, 4.5), 1.2, facecolor=C["red"], edgecolor=C["blue"], linewidth=3))
    ax.text(8, 4.5, "NRCS\nSEIP", fontsize=14, ha="center", va="center", color=C["white"], fontweight="bold")
    nodes = [
        (8, 7.2, "Ambulance", C["blue"]), (11.5, 5.8, "Training", C["gold"]),
        (10.5, 2.5, "Events", C["charcoal"]), (5.5, 2.5, "Lodge", C["lodge"]),
        (4.5, 5.8, "Donors", C["donors"]), (8, 1.5, "Relationships", C["relationships"]),
    ]
    for x, y, label, col in nodes:
        ax.add_patch(Circle((x, y), 0.75, facecolor=col, alpha=0.9))
        ax.text(x, y, label, fontsize=10, ha="center", va="center", color=C["white"], fontweight="bold")
        ax.plot([8, x], [4.5, y], color=C["slate"], linewidth=1.5, alpha=0.5)
    for i in range(len(nodes)):
        x1, y1, _, _ = nodes[i]
        x2, y2, _, _ = nodes[(i + 2) % len(nodes)]
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="-", color=C["medium_gray"], lw=0.8, connectionstyle="arc3,rad=0.2"))
    add_footer(ax)
    save_asset(fig, "03_flywheel.png")


def asset_04():
    fig, ax = new_fig()
    ax.text(8, 8.3, "Market Opportunity Pyramid", fontsize=26, ha="center", color=C["blue"], fontweight="bold")
    layers = [
        (2, 1.2, 12, 1.5, C["blue"], "TAM", "NGN 957.2B – 2.12TN"),
        (3.5, 2.9, 9, 1.3, C["gold"], "SAM", "NGN 74.5B – 188.2B"),
        (5.5, 4.4, 5, 1.1, C["red"], "SOM", "NGN 1.3B – 3.18B"),
    ]
    for x, y, w, h, col, title, val in layers:
        tri = Polygon([(x, y), (x + w, y), (x + w / 2, y + h)], closed=True, facecolor=col, edgecolor=C["white"], lw=2)
        ax.add_patch(tri)
        ax.text(x + w / 2, y + h / 2, f"{title}\n{val}", fontsize=11, ha="center", va="center", color=C["white"], fontweight="bold")
    rounded_box(ax, 11, 2, 4.5, 4.5, C["light_blue"])
    ax.text(13.25, 5.8, "Growth Drivers", fontsize=14, ha="center", color=C["blue"], fontweight="bold")
    drivers = ["Healthcare gap", "NGO demand", "Corporate CSR", "Govt outsourcing", "Tourism growth"]
    for i, d in enumerate(drivers):
        ax.text(13.25, 5.2 - i * 0.55, f"• {d}", fontsize=10, ha="center", color=C["charcoal"])
    add_footer(ax)
    save_asset(fig, "04_market_pyramid.png")


def asset_05():
    fig, ax = new_fig()
    ax.text(8, 8.3, "Competitive Positioning", fontsize=26, ha="center", color=C["blue"], fontweight="bold")
    ax.plot([2, 14], [2, 2], color=C["slate"], lw=2)
    ax.plot([2, 2], [2, 7.5], color=C["slate"], lw=2)
    ax.text(8, 1.5, "Integration →", fontsize=12, ha="center", color=C["charcoal"])
    ax.text(1.3, 4.8, "Speed\n↑", fontsize=12, ha="center", color=C["charcoal"], rotation=90)
    quads = [("Low/Low", 4, 3.5), ("High/Low", 11, 3.5), ("Low/High", 4, 6.5), ("High/High", 11, 6.5)]
    for lbl, x, y in quads:
        ax.text(x, y, lbl, fontsize=9, ha="center", color=C["slate"], alpha=0.7)
    competitors = [
        ("NRCS SEIP", 12.5, 6.8, C["red"], 200),
        ("Red Cross Intl", 6, 5, C["blue"], 80), ("St John", 5, 4.2, C["charcoal"], 60),
        ("Private EMS A", 9, 6, C["gold"], 70), ("Private EMS B", 10, 5.5, C["gold"], 60),
        ("NGO Provider", 4, 5.5, C["slate"], 50), ("Govt EMS", 3, 3.5, C["charcoal"], 55),
        ("Hotel Chain", 8, 3.2, C["lodge"], 65), ("Training Co", 7, 4.5, C["gold"], 55),
        ("Event Venue", 6.5, 3.8, C["charcoal"], 50), ("Fundraising SaaS", 9.5, 4, C["donors"], 45),
        ("Intl NGO", 5.5, 6, C["blue"], 55),
    ]
    for name, x, y, col, sz in competitors:
        ax.scatter([x], [y], s=sz, c=col, zorder=5, edgecolors=C["white"], linewidths=1)
        if name == "NRCS SEIP":
            ax.text(x, y + 0.35, "★ " + name, fontsize=11, ha="center", color=C["red"], fontweight="bold")
        else:
            ax.text(x, y - 0.35, name, fontsize=7, ha="center", color=C["charcoal"])
    add_footer(ax)
    save_asset(fig, "05_competitive_matrix.png")


def asset_06():
    fig, axes = plt.subplots(2, 2, figsize=FIGSIZE, dpi=DPI)
    fig.patch.set_facecolor(C["white"])
    fig.suptitle("Financial Dashboard", fontsize=22, color=C["blue"], fontweight="bold", y=0.98)
    years = ["Y1", "Y2", "Y3", "Y4", "Y5"]
    rev = [120, 280, 520, 780, 1100]
    ebitda = [-40, 20, 95, 180, 290]
    ax = axes[0, 0]
    ax.bar(years, rev, color=C["blue"], alpha=0.7, label="Revenue")
    ax2 = ax.twinx()
    ax2.plot(years, ebitda, color=C["red"], marker="o", linewidth=2, label="EBITDA")
    ax.set_title("Revenue & EBITDA (CHF K)", fontsize=11, color=C["charcoal"])
    ax = axes[0, 1]
    margins = [(-33, -5, 18, 23, 26)]
    for i, m in enumerate([(-33), (-5), (18), (23), (26)]):
        ax.plot(years[: i + 1], [(-33), (-5), (18), (23), (26)][: i + 1], marker="o")
    ax.plot(years, [-33, -5, 18, 23, 26], color=C["gold"], marker="o", linewidth=2)
    ax.set_title("Margin Progression (%)", fontsize=11, color=C["charcoal"])
    ax = axes[1, 0]
    bottom = np.zeros(5)
    streams = {"NTI": [30, 45, 60, 70, 80], "Ambulance": [40, 90, 150, 200, 280],
               "Assets": [35, 100, 220, 350, 480], "Fundraising": [15, 45, 90, 160, 260]}
    cols = [C["gold"], C["red"], C["blue"], C["donors"]]
    for (name, vals), col in zip(streams.items(), cols):
        ax.bar(years, vals, bottom=bottom, label=name, color=col)
        bottom += np.array(vals)
    ax.set_title("Revenue Mix", fontsize=11, color=C["charcoal"])
    ax.legend(fontsize=7, loc="upper left")
    ax = axes[1, 1]
    capex = [35, 25, 20, 15, 10]
    labels_p = ["Fleet", "Facilities", "CRM", "Training", "Working Cap"]
    ax.pie(capex, labels=labels_p, autopct="%1.0f%%", colors=[C["red"], C["blue"], C["gold"], C["lodge"], C["charcoal"]])
    ax.set_title("Capex Allocation", fontsize=11, color=C["charcoal"])
    fig.text(0.99, 0.02, FOOTER, fontsize=8, color=C["slate"], ha="right")
    save_asset(fig, "06_financial_dashboard.png")


def risk_color(r):
    return {1: "#2ECC71", 2: "#F39C12", 3: C["red"], 4: "#8B0000", 5: C["black"]}.get(r, C["slate"])


def asset_07():
    fig, ax = new_fig()
    ax.text(8, 8.3, "Risk Heat Map", fontsize=26, ha="center", color=C["blue"], fontweight="bold")
    risks = [
        ("Regulatory", 3, "Licensing delays", "Early engagement"),
        ("FX Exposure", 4, "NGN volatility", "USD hedging"),
        ("Fleet Ops", 3, "Maintenance costs", "SLA contracts"),
        ("Demand", 2, "Utilization", "Anchor contracts"),
        ("Talent", 3, "Skills gap", "NTI pipeline"),
        ("Donor Fatigue", 4, "Grant decline", "Revenue diversification"),
        ("Competition", 2, "Market entry", "First-mover advantage"),
        ("Reputation", 3, "Brand risk", "QC protocols"),
    ]
    for i, (cat, rating, desc, mit) in enumerate(risks):
        y = 7 - i * 0.85
        rounded_box(ax, 0.5, y - 0.35, 15, 0.7, C["light_gray"] if i % 2 == 0 else C["white"], ec=C["slate"], lw=0.5)
        ax.add_patch(Circle((1.2, y), 0.25, facecolor=risk_color(rating)))
        ax.text(1.2, y, str(rating), fontsize=10, ha="center", va="center", color=C["white"], fontweight="bold")
        ax.text(2, y, cat, fontsize=11, va="center", color=C["blue"], fontweight="bold")
        ax.text(5, y, desc, fontsize=10, va="center", color=C["charcoal"])
        ax.text(10, y, mit, fontsize=9, va="center", color=C["slate"])
        rounded_box(ax, 14, y - 0.2, 1.5, 0.4, C["light_blue"])
        ax.text(14.75, y, "Active", fontsize=7, ha="center", va="center", color=C["blue"])
    legend_y = 0.8
    for r in range(1, 6):
        ax.add_patch(Circle((1 + r * 1.5, legend_y), 0.15, facecolor=risk_color(r)))
        ax.text(1 + r * 1.5, legend_y - 0.35, str(r), fontsize=8, ha="center", color=C["charcoal"])
    add_footer(ax)
    save_asset(fig, "07_risk_heat_map.png")


def asset_08():
    fig, ax = new_fig()
    ax.text(8, 8.3, "24-Month Implementation Timeline", fontsize=24, ha="center", color=C["blue"], fontweight="bold")
    phases = [(1, 3, C["blue"], "Phase 1: Foundation"), (4, 9, C["gold"], "Phase 2: Scale"),
              (10, 24, C["lodge"], "Phase 3: Optimize")]
    for start, end, col, label in phases:
        x0 = 1 + (start - 1) * 0.55
        w = (end - start + 1) * 0.55
        ax.add_patch(Rectangle((x0, 6.5), w, 0.6, facecolor=col, alpha=0.8))
        ax.text(x0 + w / 2, 6.8, label, fontsize=8, ha="center", color=C["white"], fontweight="bold")
    activities = [
        ("Legal & Governance", 1, 3, 5.5), ("Fleet Procurement", 2, 5, 4.8),
        ("NTI Launch", 3, 8, 4.1), ("Gwarimpa Fit-out", 4, 10, 3.4),
        ("Utako Renovation", 5, 12, 2.7), ("CRM Deployment", 6, 9, 2.0),
        ("Anchor Contracts", 8, 18, 1.3),
    ]
    for name, s, e, y in activities:
        x0 = 1 + (s - 1) * 0.55
        w = (e - s + 1) * 0.55
        ax.add_patch(Rectangle((x0, y), w, 0.45, facecolor=C["charcoal"], alpha=0.7))
        ax.text(0.3, y + 0.22, name, fontsize=8, ha="right", va="center", color=C["charcoal"])
        if name in ("Fleet Procurement", "Anchor Contracts"):
            ax.scatter([x0 + w / 2], [y + 0.55], marker="D", s=80, c=C["red"], zorder=5)
    for m in range(1, 25, 3):
        ax.text(1 + (m - 1) * 0.55, 7.5, f"M{m}", fontsize=7, ha="center", color=C["slate"])
    add_footer(ax)
    save_asset(fig, "08_gantt.png")


def asset_09():
    fig, ax = new_fig()
    ax.text(8, 8.3, "SDG Impact Dashboard", fontsize=26, ha="center", color=C["blue"], fontweight="bold")
    sdgs = [
        ("SDG 3", "Health", C["lodge"], "12K→85K", "lives touched"),
        ("SDG 8", "Work", C["donors"], "45→320", "jobs created"),
        ("SDG 9", "Infrastructure", C["relationships"], "2→8", "facilities"),
        ("SDG 17", "Partnerships", C["sdg17"], "8→45", "partners"),
    ]
    for i, (num, title, col, y1, y5) in enumerate(sdgs):
        x = 1.5 + i * 3.6
        rounded_box(ax, x, 3.5, 3.2, 3.8, col, alpha=0.15, ec=col)
        ax.text(x + 1.6, 6.8, num, fontsize=18, ha="center", color=col, fontweight="bold")
        ax.text(x + 1.6, 6.2, title, fontsize=12, ha="center", color=C["charcoal"])
        ax.text(x + 1.6, 5.0, f"Y1: {y1}", fontsize=11, ha="center", color=C["blue"])
        ax.text(x + 1.6, 4.2, f"Y5: {y5}", fontsize=11, ha="center", color=C["red"], fontweight="bold")
    rounded_box(ax, 3, 1.2, 10, 1.8, C["gold"], alpha=0.3)
    ax.text(8, 2.5, "Mission Dividend: 12% of net surplus reinvested in community programs", fontsize=13, ha="center", color=C["blue"], fontweight="bold")
    add_footer(ax)
    save_asset(fig, "09_sdg_dashboard.png")


def asset_10():
    fig, axes = plt.subplots(2, 2, figsize=FIGSIZE, dpi=DPI)
    fig.patch.set_facecolor(C["white"])
    fig.suptitle("Revenue Deep Dive", fontsize=22, color=C["blue"], fontweight="bold")
    axes[0, 0].barh(["Fundraising", "Assets", "Ambulance", "NTI"], [260, 480, 280, 80], color=[C["donors"], C["blue"], C["red"], C["gold"]])
    axes[0, 0].set_title("Revenue Waterfall Y5 (CHF K)")
    axes[0, 1].plot(["Y1", "Y2", "Y3", "Y4", "Y5"], [0.8, 1.2, 1.8, 2.4, 3.1], "o-", color=C["red"], label="LTV/CAC")
    axes[0, 1].set_title("Unit Economics")
    axes[1, 0].bar(["Basic", "Adv", "EMT-B", "EMT-I", "HSE"], [26, 52, 115, 172, 172], color=C["gold"], label="Y1")
    axes[1, 0].bar(["Basic", "Adv", "EMT-B", "EMT-I", "HSE"], [38, 76, 168, 252, 252], color=C["red"], alpha=0.6, label="Y5")
    axes[1, 0].set_title("NTI Pricing Ladder (CHF)")
    axes[1, 0].legend(fontsize=7)
    axes[1, 1].plot(["Y1", "Y2", "Y3", "Y4", "Y5"], [35, 52, 68, 78, 85], "o-", color=C["blue"], label="Occupancy %")
    axes[1, 1].plot(["Y1", "Y2", "Y3", "Y4", "Y5"], [20, 40, 58, 72, 80], "s--", color=C["lodge"], label="Utilization %")
    axes[1, 1].set_title("Occupancy & Utilization Ramp")
    axes[1, 1].legend(fontsize=7)
    fig.text(0.99, 0.02, FOOTER, fontsize=8, color=C["slate"], ha="right")
    save_asset(fig, "10_revenue_deepdive.png")


def asset_11():
    fig, ax = new_fig()
    ax.text(8, 8.3, "Governance Structure", fontsize=26, ha="center", color=C["blue"], fontweight="bold")
    boxes = [
        (6, 7, 4, 0.7, "NRCS NEC", C["blue"]),
        (5, 5.8, 6, 0.7, "SE Board (5 Members)", C["red"]),
        (6.5, 4.6, 3, 0.7, "SEIP MD", C["gold"]),
    ]
    for x, y, w, h, txt, col in boxes:
        rounded_box(ax, x, y, w, h, col)
        ax.text(x + w / 2, y + h / 2, txt, fontsize=11, ha="center", va="center", color=C["white"], fontweight="bold")
    gms = ["NTI GM", "Ambulance GM", "Asset Mgmt GM", "Fundraising GM"]
    for i, gm in enumerate(gms):
        x = 1 + i * 3.5
        rounded_box(ax, x, 2.8, 2.8, 0.7, C["charcoal"])
        ax.text(x + 1.4, 3.15, gm, fontsize=9, ha="center", va="center", color=C["white"])
        ax.plot([8, x + 1.4], [4.6, 3.5], color=C["slate"], lw=1)
    for lbl, x, y in [("NSIA Oversight", 11, 6.5), ("Audit Committee", 11, 5), ("Tax Compliance", 11, 4), ("Mission Dividend", 11, 3)]:
        rounded_box(ax, x, y, 4, 0.6, C["light_blue"], ec=C["blue"])
        ax.text(x + 2, y + 0.3, lbl, fontsize=9, ha="center", va="center", color=C["blue"])
    add_footer(ax)
    save_asset(fig, "11_governance.png")


def asset_12():
    fig, axes = plt.subplots(2, 2, figsize=FIGSIZE, dpi=DPI)
    fig.patch.set_facecolor(C["white"])
    fig.suptitle("Sensitivity Analysis", fontsize=22, color=C["blue"], fontweight="bold")
    vars_ = ["Occupancy", "Pricing", "FX", "Fleet Cost", "Grants"]
    impacts = [25, 18, -15, -12, 20]
    axes[0, 0].barh(vars_, impacts, color=[C["red"] if v > 0 else C["blue"] for v in impacts])
    axes[0, 0].set_title("Tornado: Revenue Sensitivity")
    axes[0, 1].axis("off")
    axes[0, 1].set_title("Scenario Matrix (CHF K)")
    scenario_rows = [["", "Conservative", "Base", "Upside"], ["Revenue", "850", "1100", "1450"], ["EBITDA", "180", "290", "420"]]
    for i, row in enumerate(scenario_rows):
        for j, cell in enumerate(row):
            weight = "bold" if i == 0 or j == 0 else "normal"
            color = C["blue"] if i == 0 else C["charcoal"]
            axes[0, 1].text(0.15 + j * 0.22, 0.75 - i * 0.25, cell, fontsize=10, fontweight=weight, color=color, ha="center")
    axes[1, 0].axvline(18, color=C["red"], linestyle="--", label="Break-even M18")
    axes[1, 0].plot(range(1, 25), np.cumsum([-20]*6 + [5]*6 + [25]*12), color=C["blue"])
    axes[1, 0].set_title("Break-even Timeline")
    axes[1, 1].bar(["Y1", "Y2", "Y3", "Y4", "Y5"], [637, 120, 95, 80, 65], color=C["gold"])
    axes[1, 1].set_title("Capex Waterfall (CHF K)")
    fig.text(0.99, 0.02, FOOTER, fontsize=8, color=C["slate"], ha="right")
    save_asset(fig, "12_sensitivity.png")


def asset_13():
    fig, ax = new_fig()
    ax.text(8, 8.3, "Leadership Team", fontsize=26, ha="center", color=C["blue"], fontweight="bold")
    leaders = [
        ("Prince Adeaga", "Board Chair", "30+ yrs humanitarian", C["blue"]),
        ("Dr. Kende", "Medical Director", "MD, Emergency Medicine", C["red"]),
        ("Gbubemi Uba", "Operations", "Logistics & Fleet Mgmt", C["gold"]),
        ("Chikezie Okpala", "Technology", "Enterprise Systems", C["lodge"]),
        ("Bilikisu Mohammed", "Finance", "CPA, Social Enterprise", C["charcoal"]),
        ("Audu Goji", "Partnerships", "Govt & Intl Relations", C["donors"]),
    ]
    for i, (name, role, cred, col) in enumerate(leaders):
        x = 0.8 + (i % 3) * 5.2
        y = 4.5 if i < 3 else 1.2
        rounded_box(ax, x, y, 4.5, 2.8, col, alpha=0.12, ec=col)
        ax.add_patch(Circle((x + 0.6, y + 2.0), 0.4, facecolor=col))
        ax.text(x + 0.6, y + 2.0, name[0], fontsize=16, ha="center", va="center", color=C["white"], fontweight="bold")
        ax.text(x + 1.3, y + 2.2, name, fontsize=11, color=C["blue"], fontweight="bold")
        ax.text(x + 1.3, y + 1.7, role, fontsize=10, color=C["red"])
        ax.text(x + 1.3, y + 1.1, cred, fontsize=9, color=C["charcoal"])
    add_footer(ax)
    save_asset(fig, "13_leadership.png")


def asset_14():
    fig, ax = new_fig()
    ax.text(8, 8.3, "The Donor Dependency Crisis", fontsize=26, ha="center", color=C["blue"], fontweight="bold")
    pillars = [
        (2, 3, "Donor Fatigue", "Declining grants\n& competition", C["red"]),
        (6.5, 3, "Currency Risk", "NGN devaluation\nerodes value", C["blue"]),
        (11, 3, "Budget Cycles", "Unpredictable\nfunding windows", C["gold"]),
    ]
    for x, y, title, desc, col in pillars:
        rounded_box(ax, x, y, 3.5, 3.5, col, alpha=0.15, ec=col, lw=2)
        ax.text(x + 1.75, y + 2.8, title, fontsize=14, ha="center", color=col, fontweight="bold")
        ax.text(x + 1.75, y + 1.5, desc, fontsize=11, ha="center", color=C["charcoal"])
    rounded_box(ax, 4, 1.0, 8, 1.2, C["red"])
    ax.text(8, 1.6, "Solution: Self-sustaining SEIP with diversified revenue", fontsize=14, ha="center", color=C["white"], fontweight="bold")
    add_footer(ax)
    save_asset(fig, "14_donor_crisis.png")


def asset_15():
    fig, ax = new_fig()
    ax.text(8, 8.3, "Feature Comparison Matrix", fontsize=24, ha="center", color=C["blue"], fontweight="bold")
    providers = ["NRCS SEIP", "Red Cross", "St John", "Private EMS", "NGO", "Hotel", "Training Co"]
    caps = ["EMS", "Training", "Hospitality", "Events", "Fundraising"]
    data = {
        "NRCS SEIP": [1, 1, 1, 1, 1],
        "Red Cross": [1, 1, 0, 0, 0],
        "St John": [1, 1, 0, 0, 0],
        "Private EMS": [1, 0, 0, 0, 0],
        "NGO": [0, 0, 1, 1, 0],
        "Hotel": [0, 0, 1, 1, 0],
        "Training Co": [0, 1, 0, 0, 0],
    }
    for i, cap in enumerate(caps):
        ax.text(3 + i * 2.2, 7.2, cap, fontsize=10, ha="center", color=C["blue"], fontweight="bold")
    for j, prov in enumerate(providers):
        y = 6.5 - j * 0.75
        ax.text(1, y, prov, fontsize=9, ha="right", va="center", color=C["charcoal"])
        marks = data.get(prov, [0]*5)
        for i, m in enumerate(marks):
            sym = "✓" if m else "–"
            col = C["red"] if m and prov == "NRCS SEIP" else (C["gold"] if m else C["medium_gray"])
            ax.text(3 + i * 2.2, y, sym, fontsize=14, ha="center", va="center", color=col, fontweight="bold")
    add_footer(ax)
    save_asset(fig, "15_feature_matrix.png")


def asset_16():
    fig, ax = new_fig()
    ax.text(8, 8.3, "Executive Summary", fontsize=26, ha="center", color=C["blue"], fontweight="bold")
    rounded_box(ax, 0.5, 2.5, 7, 5, C["light_blue"])
    ax.text(4, 7, "Platform Overview", fontsize=14, ha="center", color=C["blue"], fontweight="bold")
    verts = [("NTI", "25%", C["gold"]), ("Ambulance", "30%", C["red"]), ("Asset Mgmt", "35%", C["blue"]), ("Fundraising", "10%", C["donors"])]
    for i, (v, pct, col) in enumerate(verts):
        ax.text(1, 6.2 - i * 0.9, f"• {v}: {pct} grant allocation", fontsize=11, color=col)
    rounded_box(ax, 8.5, 2.5, 7, 5, C["light_gray"])
    ax.text(12, 7, "Financial Highlights", fontsize=14, ha="center", color=C["blue"], fontweight="bold")
    fins = ["CHF 750K total investment", "5-year revenue: CHF 110M", "EBITDA margin Y5: 26%", "Break-even: Month 18", "Mission dividend: 12%"]
    for i, f in enumerate(fins):
        ax.text(9, 6.2 - i * 0.7, f"• {f}", fontsize=11, color=C["charcoal"])
    rounded_box(ax, 1, 0.8, 14, 1.2, C["blue"])
    ax.text(8, 1.4, "Strategic Rationale: Humanitarian mission + commercial sustainability = resilient NRCS", fontsize=12, ha="center", color=C["white"])
    add_footer(ax)
    save_asset(fig, "16_exec_summary.png")


def asset_17():
    fig, ax = new_fig()
    ax.text(8, 8.3, "Stakeholder Ecosystem", fontsize=26, ha="center", color=C["blue"], fontweight="bold")
    ax.add_patch(Circle((8, 4.5), 1.0, facecolor=C["red"]))
    ax.text(8, 4.5, "NRCS\nSEIP", fontsize=12, ha="center", va="center", color=C["white"], fontweight="bold")
    clusters = [
        (8, 7.5, "Government", C["blue"]), (13, 5.5, "International", C["gold"]),
        (12, 2, "Corporate", C["charcoal"]), (8, 1, "Community", C["donors"]),
        (4, 2, "Hospitality", C["lodge"]), (3, 5.5, "Technology", C["relationships"]),
    ]
    for x, y, label, col in clusters:
        rounded_box(ax, x - 1.5, y - 0.4, 3, 0.8, col, alpha=0.8)
        ax.text(x, y, label, fontsize=10, ha="center", va="center", color=C["white"], fontweight="bold")
        ax.plot([8, x], [4.5, y], color=C["slate"], lw=1, alpha=0.4)
    add_footer(ax)
    save_asset(fig, "17_ecosystem.png")


def asset_18():
    fig, ax = new_fig()
    ax.text(8, 8.3, "Ambulance Vertical Model", fontsize=24, ha="center", color=C["blue"], fontweight="bold")
    rounded_box(ax, 0.5, 3.5, 7, 4, C["light_blue"])
    ax.text(4, 7, "Revenue Model", fontsize=13, ha="center", color=C["blue"], fontweight="bold")
    texts_l = ["PAG: Emergency response billing", "Subscription: Corporate retainers", "Fleet: 10 units Y1 → 25 Y5", "Indigent quota: 15% capacity"]
    for i, t in enumerate(texts_l):
        ax.text(1, 6.5 - i * 0.7, f"• {t}", fontsize=10, color=C["charcoal"])
    rounded_box(ax, 8.5, 3.5, 7, 4, C["light_gray"])
    ax.text(12, 7, "Target Contracts", fontsize=13, ha="center", color=C["blue"], fontweight="bold")
    contracts = ["FAAN", "FRSC", "Police", "Shell/Chevron/Total", "UN Agencies"]
    for i, c in enumerate(contracts):
        ax.text(9, 6.5 - i * 0.65, f"• {c}", fontsize=10, color=C["charcoal"])
    ax2 = fig.add_axes([0.15, 0.08, 0.7, 0.2])
    ax2.plot(["Y1", "Y2", "Y3", "Y4", "Y5"], [40, 90, 150, 200, 280], "o-", color=C["red"], linewidth=2)
    ax2.set_title("5-Year Ambulance Revenue (CHF K)", fontsize=10)
    ax2.set_facecolor(C["white"])
    add_footer(ax)
    save_asset(fig, "18_ambulance_model.png")


def asset_19():
    fig, ax = new_fig()
    ax.text(8, 8.3, "Asset Management Vertical", fontsize=24, ha="center", color=C["blue"], fontweight="bold")
    rounded_box(ax, 0.5, 3.5, 7, 4, C["light_blue"])
    ax.text(4, 7, "Gwarimpa Event Halls", fontsize=13, ha="center", color=C["blue"], fontweight="bold")
    for i, t in enumerate(["Large Hall: 500 capacity", "Medium Hall: 200 capacity", "Utilisation: 35%→85%"]):
        ax.text(1, 6.3 - i * 0.7, f"• {t}", fontsize=10, color=C["charcoal"])
    rounded_box(ax, 8.5, 3.5, 7, 4, C["light_gray"])
    ax.text(12, 7, "Utako Lodge", fontsize=13, ha="center", color=C["blue"], fontweight="bold")
    ax.add_patch(Circle((12, 5.5), 0.6, facecolor=C["lodge"]))
    ax.text(12, 5.5, "16\nRooms", fontsize=10, ha="center", va="center", color=C["white"], fontweight="bold")
    for i, t in enumerate(["Occupancy ramp: 40%→82%", "Channels: NGOs, Govt, Corporate", "ADR: NGN 45K→65K"]):
        ax.text(9, 4.5 - i * 0.6, f"• {t}", fontsize=10, color=C["charcoal"])
    ax2 = fig.add_axes([0.15, 0.08, 0.7, 0.2])
    ax2.bar(["Y1", "Y2", "Y3", "Y4", "Y5"], [35, 100, 220, 350, 480], color=C["blue"])
    ax2.set_title("5-Year Asset Revenue (CHF K)", fontsize=10)
    add_footer(ax)
    save_asset(fig, "19_asset_mgmt.png")


def asset_20():
    fig, ax = new_fig()
    ax.text(8, 8.3, "Fundraising Vertical", fontsize=24, ha="center", color=C["blue"], fontweight="bold")
    rounded_box(ax, 0.5, 3.5, 7, 4, C["light_blue"])
    ax.text(4, 7, "CRM Infrastructure", fontsize=13, ha="center", color=C["blue"], fontweight="bold")
    for i, t in enumerate(["Salesforce Nonprofit Cloud", "Paystack payment gateway", "Flutterwave multi-channel"]):
        ax.text(1, 6.3 - i * 0.7, f"• {t}", fontsize=10, color=C["charcoal"])
    rounded_box(ax, 8.5, 3.5, 7, 4, C["light_gray"])
    ax.text(12, 7, "Corporate Tiers", fontsize=13, ha="center", color=C["blue"], fontweight="bold")
    tiers = [("Bronze", "NGN 5M", C["charcoal"]), ("Silver", "NGN 15M", C["slate"]),
             ("Gold", "NGN 35M", C["gold"]), ("Platinum", "NGN 75M+", C["red"])]
    for i, (name, val, col) in enumerate(tiers):
        rounded_box(ax, 9, 6.2 - i * 0.85, 5.5, 0.65, col, alpha=0.3)
        ax.text(11.75, 6.55 - i * 0.85, f"{name}: {val}", fontsize=10, ha="center", color=C["charcoal"])
    ax2 = fig.add_axes([0.15, 0.08, 0.7, 0.2])
    ax2.plot(["Y1", "Y2", "Y3", "Y4", "Y5"], [15, 45, 90, 160, 260], "s-", color=C["donors"], linewidth=2)
    ax2.set_title("Donor Development Milestones (CHF K)", fontsize=10)
    add_footer(ax)
    save_asset(fig, "20_fundraising.png")


def asset_21():
    fig, ax = new_fig()
    ax.text(8, 8.3, "NTI Training Courses", fontsize=24, ha="center", color=C["blue"], fontweight="bold")
    courses = [
        ("Basic First Aid", "26→38"), ("Advanced", "52→76"), ("EMT-Basic", "115→168"),
        ("EMT-Intermediate", "172→252"), ("Corporate HSE", "115-229→168-335"),
    ]
    for i, (name, price) in enumerate(courses):
        x = 0.5 + i * 3.1
        rounded_box(ax, x, 4.5, 2.8, 2.5, C["gold"], alpha=0.2, ec=C["gold"])
        ax.text(x + 1.4, 6.2, name, fontsize=9, ha="center", color=C["blue"], fontweight="bold")
        ax.text(x + 1.4, 5.3, f"CHF {price}", fontsize=10, ha="center", color=C["red"])
    rounded_box(ax, 10, 4, 5.5, 3.5, C["light_blue"])
    ax.text(12.75, 7, "Accreditation", fontsize=12, ha="center", color=C["blue"], fontweight="bold")
    for i, a in enumerate(["MDCN", "ILCOR", "NCDMB", "FMOH"]):
        ax.text(12.75, 6.2 - i * 0.5, f"• {a}", fontsize=10, ha="center", color=C["charcoal"])
    ax2 = fig.add_axes([0.15, 0.08, 0.7, 0.2])
    ax2.plot(["Y1", "Y2", "Y3", "Y4", "Y5"], [500, 1200, 2500, 4200, 6500], "o-", color=C["gold"])
    ax2.set_title("Trainee Volume Ramp", fontsize=10)
    add_footer(ax)
    save_asset(fig, "21_nti_courses.png")


def asset_22():
    fig, ax = new_fig()
    ax.text(8, 8.3, "Go-To-Market Strategy", fontsize=24, ha="center", color=C["blue"], fontweight="bold")
    strategies = [
        ("NTI", "4 channels", "Corporate, Govt, Schools, Online", C["gold"]),
        ("Event Halls", "3 channels", "Weddings, Corporate, NGO", C["blue"]),
        ("Utako Lodge", "4 channels", "NGO, Govt, Corporate, OTA", C["lodge"]),
        ("Ambulance", "3 channels", "PAG, Subscription, Insurance", C["red"]),
        ("Fundraising", "3 channels", "CRM, Events, Corporate tiers", C["donors"]),
    ]
    for i, (name, ch, desc, col) in enumerate(strategies):
        x = 0.5 + (i % 3) * 5.2
        y = 4.8 if i < 3 else 1.5
        rounded_box(ax, x, y, 4.8, 2.5, col, alpha=0.15, ec=col)
        ax.text(x + 2.4, y + 2.0, name, fontsize=12, ha="center", color=col, fontweight="bold")
        ax.text(x + 2.4, y + 1.4, ch, fontsize=10, ha="center", color=C["blue"])
        ax.text(x + 2.4, y + 0.6, desc, fontsize=8, ha="center", color=C["charcoal"])
    add_footer(ax)
    save_asset(fig, "22_gtm_strategy.png")


def asset_23():
    fig, ax = new_fig()
    ax.text(8, 8.3, "Abuja Hospitality Gap", fontsize=24, ha="center", color=C["blue"], fontweight="bold")
    segments = [
        (1, 3, 4.5, "Premium", "Transcorp Hilton\nAbuja Continental", C["blue"]),
        (6, 3, 4.5, "MISSING MIDDLE", "NGOs • Corporates\nGovernment delegations", C["red"]),
        (11, 3, 4.5, "Budget", "Unbranded\nguest houses", C["charcoal"]),
    ]
    for x, y, w, title, brands, col in segments:
        rounded_box(ax, x, y, w, 3.5, col, alpha=0.15 if title != "MISSING MIDDLE" else 0.35, ec=col, lw=3 if title == "MISSING MIDDLE" else 1)
        ax.text(x + w/2, y + 2.8, title, fontsize=13, ha="center", color=col, fontweight="bold")
        ax.text(x + w/2, y + 1.5, brands, fontsize=10, ha="center", color=C["charcoal"])
    ax.annotate("", xy=(8, 2.2), xytext=(8, 1.2), arrowprops=dict(arrowstyle="->", color=C["red"], lw=3))
    ax.text(8, 0.9, "NRCS SEIP positions here →", fontsize=12, ha="center", color=C["red"], fontweight="bold")
    add_footer(ax)
    save_asset(fig, "23_hospitality_gap.png")


def asset_24():
    fig, axes = plt.subplots(2, 3, figsize=FIGSIZE, dpi=DPI)
    fig.patch.set_facecolor(C["white"])
    fig.suptitle("Financial Statements Overview", fontsize=20, color=C["blue"], fontweight="bold")
    years = ["Y1", "Y2", "Y3", "Y4", "Y5"]
    axes[0, 0].bar(years, [120, 280, 520, 780, 1100], color=C["blue"], alpha=0.6, label="Revenue")
    axes[0, 0].bar(years, [80, 60, 50, 40, 30], bottom=[120, 280, 520, 780, 1100], color=C["gold"], alpha=0.6, label="Grant")
    axes[0, 0].set_title("P&L Summary", fontsize=9)
    axes[0, 1].pie([40, 35, 25], labels=["Fixed", "Current", "Intangibles"], colors=[C["blue"], C["gold"], C["red"]])
    axes[0, 1].set_title("Balance Sheet", fontsize=9)
    axes[0, 2].bar(["Op CF", "Capex", "Closing"], [180, -120, 60], color=[C["donors"], C["red"], C["blue"]])
    axes[0, 2].set_title("Cash Flow", fontsize=9)
    axes[1, 0].plot(years, [-33, -5, 18, 23, 26], "o-", color=C["red"])
    axes[1, 0].set_title("Key Metrics (%)", fontsize=9)
    bottom = np.zeros(5)
    for name, vals, col in [("NTI", [30, 45, 60, 70, 80], C["gold"]),
                            ("Amb", [40, 90, 150, 200, 280], C["red"]),
                            ("Ast", [35, 100, 220, 350, 480], C["blue"])]:
        axes[1, 1].bar(years, vals, bottom=bottom, label=name, color=col)
        bottom += np.array(vals)
    axes[1, 1].set_title("Revenue Mix", fontsize=9)
    axes[1, 1].legend(fontsize=6)
    axes[1, 2].axis("off")
    axes[1, 2].text(0.5, 0.5, "EBITDA: -40→290\nPAT: -55→195\nROE: N/A→28%", fontsize=11, ha="center", transform=axes[1, 2].transAxes)
    axes[1, 2].set_title("Highlights", fontsize=9)
    fig.text(0.99, 0.02, FOOTER, fontsize=8, color=C["slate"], ha="right")
    save_asset(fig, "24_financial_statements.png")


ASSETS = [
    asset_01, asset_02, asset_03, asset_04, asset_05, asset_06, asset_07, asset_08,
    asset_09, asset_10, asset_11, asset_12, asset_13, asset_14, asset_15, asset_16,
    asset_17, asset_18, asset_19, asset_20, asset_21, asset_22, asset_23, asset_24,
]

if __name__ == "__main__":
    print(f"Output directory: {OUTPUT_DIR}")
    for i, fn in enumerate(ASSETS, 1):
        print(f"Generating asset {i}/24...")
        fn()
    print(f"\nAll 24 assets saved to {OUTPUT_DIR}")
