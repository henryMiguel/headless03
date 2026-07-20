const WIKI_URL = "https://frictiondesign.fba.up.pt/mediawiki/api.php";
const BASE_URL = "https://frictiondesign.fba.up.pt";

// 1. Decide what to show based on the URL (SPA behavior)
const urlParams = new URLSearchParams(window.location.search);
const PAGE_NAME = urlParams.get("page");
const siteHeader = document.querySelector(".site-header");

if (PAGE_NAME) {
  // URL has "?page=X", hide table, show article
  if (siteHeader) siteHeader.style.display = "none";
  document.getElementById("home-view").style.display = "none";
  document.getElementById("article-view").style.display = "block";
  fetchArticle(PAGE_NAME);
} else {
  // No page in URL, show the home page table
  if (siteHeader) siteHeader.style.display = "flex";
  document.getElementById("home-view").style.display = "grid";
  document.getElementById("article-view").style.display = "none";
  fetchPatternList();
}

// 2. FETCH THE LIST OF PATTERNS
async function fetchPatternList() {
  // Ask Wiki for all pages inside "Category:Pattern"
  const params = new URLSearchParams({
    action: "query",
    list: "categorymembers",
    cmtitle: "Category:Pattern",
    cmlimit: 100, // Max number to fetch
    format: "json",
    origin: "*",
  });

  try {
    const response = await fetch(`${WIKI_URL}?${params}`);
    const data = await response.json();

    const pages = data.query.categorymembers;
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = ""; // Clear loading text

    if (pages.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3">No patterns found. Make sure pages are tagged with [[Category:Pattern]]</td></tr>`;
      return;
    }

    // Build the table rows
    pages.forEach((page) => {
      const row = document.createElement("tr");
      // Column 1 is a link to the article view. Columns 2 & 3 are hardcoded "Pending" for now.
      row.innerHTML = `
                        <td><a href="index.html?page=${encodeURIComponent(page.title)}" class="pattern-link">${page.title}</a></td>
                        <td style="color: #999;">Pending...</td>
                        <td style="color: #999;">Pending...</td>
                    `;
      tbody.appendChild(row);
    });

    // call rhizome rendering function after table is populated
    renderRhizome(pages);
  } catch (error) {
    console.error("Error fetching pattern list:", error);
    document.getElementById("table-body").innerHTML =
      `<tr><td colspan="3">Failed to load patterns.</td></tr>`;
  }
}

// 3. FETCH A SPECIFIC ARTICLE
async function fetchArticle(title) {
  const params = new URLSearchParams({
    action: "parse",
    page: title,
    format: "json",
    origin: "*",
    disableeditsection: true,
    disablelimitreport: true,
  });

  try {
    const response = await fetch(`${WIKI_URL}?${params}`);
    const data = await response.json();

    if (data.error) {
      document.getElementById("content").innerHTML =
        `<p style="color:red">Error: ${data.error.info}</p>`;
      return;
    }

    document.getElementById("page-title").innerText = data.parse.title;
    const contentDiv = document.getElementById("content");
    contentDiv.innerHTML = data.parse.text["*"];

    // Fix Images
    contentDiv.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      if (src && src.startsWith("/")) img.setAttribute("src", BASE_URL + src);

      const srcset = img.getAttribute("srcset");
      if (srcset) {
        img.setAttribute(
          "srcset",
          srcset
            .split(",")
            .map((s) => {
              const [url, descriptor] = s.trim().split(" ");
              return `${BASE_URL + url} ${descriptor || ""}`;
            })
            .join(", "),
        );
      }
    });

    // Fix Links so they stay in the SPA Router
    contentDiv.querySelectorAll("a").forEach((link) => {
      const href = link.getAttribute("href");
      if (href && href.includes("/mediawiki/index.php/")) {
        const linkTitle = href.split("/").pop();
        link.setAttribute("href", `index.html?page=${linkTitle}`);
      }
    });
  } catch (error) {
    console.error("Error fetching article:", error);
    document.getElementById("content").innerText = "Failed to load content.";
  }
}

// --- VIEW TOGGLE LOGIC ---
const btnRhizome = document.getElementById("btn-rhizome");
const btnList = document.getElementById("btn-list");
const rhizomeCanvas = document.getElementById("rhizome-canvas");
const patternTable = document.getElementById("pattern-table");

btnList.addEventListener("click", () => {
  btnList.classList.add("blue-btn");
  btnList.classList.remove("active");
  btnRhizome.classList.add("active");
  btnRhizome.classList.remove("blue-btn");

  rhizomeCanvas.style.display = "none";
  patternTable.style.display = "table";
});

btnRhizome.addEventListener("click", () => {
  btnRhizome.classList.add("blue-btn");
  btnRhizome.classList.remove("active");
  btnList.classList.add("active");
  btnList.classList.remove("blue-btn");

  patternTable.style.display = "none";
  rhizomeCanvas.style.display = "block";
});

// --- D3 RHIZOME GRAPH LOGIC ---
function renderRhizome(pages) {
  // 1. Setup the data (Because you don't have Tactics/Intentions yet,
  // we will fake the "Rhizome" by linking random patterns together for now)
  const nodes = pages
    .filter((p) => p.title !== "Main_Page")
    .map((p) => ({ id: p.title }));
  const links = [];

  // Create random connections to make it look like a web
  for (let i = 0; i < nodes.length; i++) {
    const targetIndex = Math.floor(Math.random() * nodes.length);
    if (i !== targetIndex) {
      links.push({ source: nodes[i].id, target: nodes[targetIndex].id });
    }
  }

  // 2. Clear out any old graph
  document.getElementById("rhizome-canvas").innerHTML = "";

  // 3. Setup the D3 SVG Canvas
  const width = 950;
  // const width = document.getElementById("rhizome-canvas").clientWidth;
  const height = 700;
  const svg = d3
    .select("#rhizome-canvas")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("cursor", "grab"); // Gives the user a hint they can drag the background

  // --- THE NEW ZOOM MAGIC ---
  // 3a. Create a "Master Group" that holds everything
  const mainGroup = svg.append("g");

  // 3b. Define the Zoom behavior (Min zoom 0.25x, Max zoom 4x)
  const zoom = d3
    .zoom()
    .scaleExtent([0.25, 4])
    .on("zoom", (event) => {
      // When the user scrolls or drags, apply the math to the Master Group
      mainGroup.attr("transform", event.transform);
    });

  // 3c. Turn on the zoom for the whole SVG canvas
  svg.call(zoom);
  // --------------------------

  // 4. Setup the Physics Engine
  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d3) => d3.id)
        .distance(150),
    )
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(40));

  // 5. Draw the lines (Links) - NOTICE WE APPEND TO mainGroup NOW!
  const link = mainGroup
    .append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("class", "rhizome-link");

  // 6. Draw the text (Nodes) - NOTICE WE APPEND TO mainGroup NOW!
  const node = mainGroup
    .append("g")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .attr("class", "node-text")
    .text((d) => d.id)
    .on("click", (event, d) => {
      window.location.href = `index.html?page=${encodeURIComponent(d.id)}`;
    })
    .call(drag(simulation));

  // 7. Make it move on every "tick" of the physics engine
  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    node
      .attr("x", (d) => d.x - 20) // Center text slightly
      .attr("y", (d) => d.y);
  });

  // Physics Dragging functionality
  function drag(simulation) {
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }
}

// --- INTERACTIVE HEADER LOGIC (Slow-Motion Gravity) ---
function initGravityHeader() {
  const headerTitleLink = document.querySelector(".site-header .logo-area h1");
  if (!headerTitleLink) return;

  const text = headerTitleLink.innerText;
  headerTitleLink.innerHTML = "";

  let letters = [];

  // 1. Wrap each letter and prep its physics properties
  text.split("").forEach((char) => {
    if (char === " ") {
      headerTitleLink.appendChild(document.createTextNode(" "));
    } else {
      const span = document.createElement("span");
      span.innerText = char;
      span.style.display = "inline-block";
      headerTitleLink.appendChild(span);

      letters.push({
        element: span,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rotation: 0,
        vr: 0,
        isFalling: false,
      });
    }
  });

  const headerArea = document.querySelector(".site-header");
  let gravityActive = false;

  // 2. Trigger the slow collapse on mouse enter
  headerArea.addEventListener("mouseenter", () => {
    if (gravityActive) return;
    gravityActive = true;

    letters.forEach((l) => {
      l.isFalling = true;
      l.element.style.transition = "none";

      // VERY gentle initial drift (almost zero-G)
      l.vx = (Math.random() - 0.5) * 1.5; // Slight horizontal drift
      l.vy = Math.random() * -1; // Tiny upward bump before sinking
      l.vr = (Math.random() - 0.5) * 1; // Very slow rotation
    });

    requestAnimationFrame(physicsLoop);
  });

  // 3. The Physics Engine
  function physicsLoop() {
    let stillMoving = false;

    const floor = headerArea.clientHeight - headerTitleLink.offsetTop - 50;

    letters.forEach((l) => {
      if (!l.isFalling) return;

      // --- THE MAGIC NUMBER: SLOW GRAVITY ---
      l.vy += 0.001; // Was 1.2. This makes it fall incredibly slowly.

      // Add a tiny bit of air resistance so they don't slide infinitely
      l.vx *= 0.99;
      l.vr *= 0.99;

      l.x += l.vx;
      l.y += l.vy;
      l.rotation += l.vr;

      // Soft landing on the floor (no bouncy rubber effect)
      if (l.y > floor) {
        l.y = floor;
        l.vy *= -0.1; // Barely bounces
        l.vx *= 0.8; // Sticks to the floor
        l.vr *= 0.8;
      }

      // Lowered the movement threshold so the animation doesn't cut off early
      if (Math.abs(l.vy) > 0.05 || Math.abs(l.vx) > 0.05 || l.y < floor) {
        stillMoving = true;
      }

      l.element.style.transform = `translate(${l.x}px, ${l.y}px) rotate(${l.rotation}deg)`;
    });

    if (stillMoving) {
      requestAnimationFrame(physicsLoop);
    }
  }

  // 4. Smoothly reconstruct the title when the mouse leaves
  headerArea.addEventListener("mouseleave", () => {
    gravityActive = false;
    letters.forEach((l) => {
      l.isFalling = false;
      l.x = 0;
      l.y = 0;
      l.rotation = 0;
      // A long, 1.5-second smooth transition back to place
      l.element.style.transition =
        "transform 1.5s cubic-bezier(0.25, 1, 0.5, 1)";
      l.element.style.transform = `translate(0px, 0px) rotate(0deg)`;
    });
  });
}

initGravityHeader();

function draw() {
  // clear() makes the canvas transparent so your #2b24ff blue CSS background shows through
  clear();

  // Example Interaction: Draw white squares wherever the mouse moves
  // (P5 still tracks mouseX and mouseY even with pointer-events: none!)
  fill(255, 255, 255, 50); // White with low opacity
  noStroke();

  // Only draw if the mouse is currently hovering inside the header area
  if (mouseY > 0 && mouseY < height) {
    rect(mouseX - 25, mouseY - 25, 50, 50);
  }
}

// Automatically resize the canvas if the user resizes their browser window
function windowResized() {
  const container = document.getElementById("p5-canvas-container");
  if (container) {
    resizeCanvas(container.clientWidth, container.clientHeight);
  }
}2