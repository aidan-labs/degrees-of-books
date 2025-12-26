// graph.js

const DEGREE_COLORS = [
  "hsl(142, 76%, 45%)",  // Start
  "hsl(38, 100%, 55%)",  
  "hsl(280, 70%, 55%)",  
  "hsl(200, 80%, 55%)",  
  "hsl(340, 75%, 55%)",  
  "hsl(60, 80%, 50%)",   
  "hsl(160, 70%, 50%)",  
  "hsl(20, 85%, 55%)",   
  "hsl(180, 75%, 50%)",  
  "hsl(300, 70%, 55%)",  
];

const END_COLOR = "hsl(0, 75%, 55%)";

let currentGraph = null;
let currentZoom = null;
let hoveredNode = null;
let tooltipTimeout = null;
let isDragging = false;
let currentSimulation = null;
let isMobile = false;
let touchStartTime = 0;
let touchStartPos = { x: 0, y: 0 };

function detectMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
    .test(navigator.userAgent) 
    || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches)
    || ('ontouchstart' in window);
}

function getNodeColor(node, totalDegrees) {
  if (node.degree === 0) return DEGREE_COLORS[0];
  if (node.degree === totalDegrees) return END_COLOR;
  return DEGREE_COLORS[Math.min(node.degree, DEGREE_COLORS.length - 1)];
}

function getNodeRadius(node, totalDegrees) {
  if (node.isEndpoint) return isMobile ? 22 : 18;
  return isMobile ? 8 : 6;
}

function getHitboxRadius(node) {
  if (node.isEndpoint) return isMobile ? 50 : 25;
  return isMobile ? 25 : 15;
}

function initializeGraph(result) {
  currentGraph = result;
  isMobile = detectMobile();
  
  const svg = d3.select("#graph-svg");
  svg.selectAll("*").remove();
  
  const container = document.querySelector(".graph-wrapper");
  const { width, height } = container.getBoundingClientRect();
  
  const nodesCopy = result.nodes.map(d => ({ ...d }));
  const linksCopy = result.links.map(d => ({ ...d }));
  
  // Initial positions
  nodesCopy.forEach(node => {
    const angleOffset = (node.degree / (result.degrees + 1)) * Math.PI * 2;
    const radius = Math.min(width, height) * 0.25;
    const jitter = Math.random() * 60 - 30;
    
    node.x = width / 2 + Math.cos(angleOffset) * radius + jitter;
    node.y = height / 2 + Math.sin(angleOffset) * radius + jitter;
  });
  
  const g = svg.append("g");
  
  const zoom = d3
    .zoom()
    .scaleExtent(isMobile ? [0.3, 3] : [0.2, 4])
    .on("zoom", event => {
      g.attr("transform", event.transform);
    });
  
  currentZoom = zoom;
  svg.call(zoom).on("dblclick.zoom", null);
  
  const defs = svg.append("defs");
  
  // Glow filter
  const filter = defs
    .append("filter")
    .attr("id", "glow")
    .attr("x", "-50%")
    .attr("y", "-50%")
    .attr("width", "200%")
    .attr("height", "200%");
  
  filter
    .append("feGaussianBlur")
    .attr("stdDeviation", "3")
    .attr("result", "coloredBlur");
  
  const feMerge = filter.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "coloredBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");
  
  // Arrow markers
  [
    { id: "arrow", refX: isMobile ? 20 : 18 },
    { id: "arrow-end", refX: isMobile ? 26 : 22 }
  ].forEach(({ id, refX }) => {
    defs
      .append("marker")
      .attr("id", id)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", refX)
      .attr("refY", 0)
      .attr("markerWidth", isMobile ? 5 : 4)
      .attr("markerHeight", isMobile ? 5 : 4)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "hsl(215, 20%, 50%)");
  });
  
  // Links
  const link = g
    .append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(linksCopy)
    .join("line")
    .attr("stroke", "hsl(215, 20%, 45%)")
    .attr("stroke-width", isMobile ? 2 : 1.5)
    .attr("stroke-opacity", 0.5)
    .attr("marker-end", d => {
      const targetIsEnd = d.target.isEndpoint && 
        d.target.degree === result.degrees;
      return targetIsEnd ? "url(#arrow-end)" : "url(#arrow)";
    });
  
  const node = g
    .append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(nodesCopy)
    .join("g")
    .attr("cursor", d => (d.isEndpoint ? "grab" : "default"));

  // Clip paths
  defs
    .selectAll("clipPath")
    .data(nodesCopy)
    .join("clipPath")
    .attr("id", d => `clip-${d.id}`)
    .append("circle")
    .attr("r", d => getNodeRadius(d, result.degrees));

  // Hitbox
  node
    .append("circle")
    .attr("class", "hitbox")
    .attr("r", d => getHitboxRadius(d))
    .attr("fill", "transparent")
    .attr("stroke", "none")
    .attr("pointer-events", "all");

  // Glow
  node
    .append("circle")
    .attr("r", d => getNodeRadius(d, result.degrees) + 3)
    .attr("fill", d => getNodeColor(d, result.degrees))
    .attr("opacity", d => (d.isEndpoint ? 0.3 : 0))
    .attr("pointer-events", "none");

  // Node circles
  node
    .append("circle")
    .attr("r", d => getNodeRadius(d, result.degrees))
    .attr("fill", d => getNodeColor(d, result.degrees))
    .attr("stroke", d => {
      const rgb = d3.rgb(getNodeColor(d, result.degrees));
      return rgb.darker(2).toString();
    })
    .attr("stroke-width", isMobile ? 2.5 : 2)
    .attr("filter", d => (d.isEndpoint ? "url(#glow)" : "none"))
    .attr("pointer-events", "none");
  
  // Book covers
  node.each(function(d) {
    const group = d3.select(this);
    const nodeRadius = getNodeRadius(d, result.degrees);
    const hasValidImage = d.image_url && !d.image_url.includes("nophoto");
    
    if (d.isEndpoint && hasValidImage) {
      const img = new Image();
      img.onload = () => {
        group
          .append("image")
          .attr("xlink:href", d.image_url)
          .attr("x", -nodeRadius)
          .attr("y", -nodeRadius)
          .attr("width", nodeRadius * 2)
          .attr("height", nodeRadius * 2)
          .attr("clip-path", `url(#clip-${d.id})`)
          .attr("preserveAspectRatio", "xMidYMid slice")
          .attr("pointer-events", "none");
      };
      img.src = d.image_url;
    }
  });
  
  // Labels
  const labels = g
    .append("g")
    .attr("class", "node-labels")
    .selectAll("text")
    .data(nodesCopy)
    .join("text")
    .attr("text-anchor", "middle")
    .attr("dy", d => {
      if (d.isEndpoint) return isMobile ? 28 : 24;
      return isMobile ? 14 : 12;
    })
    .attr("font-size", d => {
      if (d.isEndpoint) return isMobile ? "12px" : "11px";
      return isMobile ? "10px" : "9px";
    })
    .attr("font-weight", d => (d.isEndpoint ? "600" : "500"))
    .attr("fill", "var(--foreground)")
    .attr("pointer-events", "none")
    .style("text-shadow", "0 0 3px var(--background)")
    .text(d => {
      const title = d.title;
      const maxLength = isMobile ? 15 : 20;
      if (title.length > maxLength) {
        return title.substring(0, maxLength - 3) + "...";
      }
      return title;
    });
  
  // Drag
  const drag = d3
    .drag()
    .on("start", function(event, d) {
      if (!d.isEndpoint) return;
      
      isDragging = true;
      hideTooltip();
      svg.on('.zoom', null);
      
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
      d3.select(this).attr("cursor", "grabbing");
    })
    .on("drag", (event, d) => {
      if (!d.isEndpoint) return;
      d.fx = event.x;
      d.fy = event.y;
    })
    .on("end", function(event, d) {
      if (!d.isEndpoint) return;
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
      d3.select(this).attr("cursor", "grab");
      
      setTimeout(() => {
        svg.call(zoom);
        isDragging = false;
      }, 100);
    });
  
  node.call(drag);
  
  // Touch interactions
  if (isMobile) {
    node.on("touchstart", function(event, d) {
      touchStartTime = Date.now();
      const touch = event.touches[0];
      touchStartPos = { x: touch.clientX, y: touch.clientY };
    });
    
    node.on("touchend", function(event, d) {
      const touchDuration = Date.now() - touchStartTime;
      const touch = event.changedTouches[0];
      const touchEndPos = { x: touch.clientX, y: touch.clientY };
      const distance = Math.sqrt(
        Math.pow(touchEndPos.x - touchStartPos.x, 2) + 
        Math.pow(touchEndPos.y - touchStartPos.y, 2)
      );
      
      if (touchDuration < 200 && distance < 10 && !isDragging) {
        event.preventDefault();
        showTooltip(d, touch.clientX, touch.clientY);
        
        setTimeout(() => {
          hideTooltip();
        }, 3000);
      }
    });
  }
  
  // Hover
  if (!isMobile) {
    node
      .on("mouseenter", function(event, d) {
        if (isDragging) return;
        
        hoveredNode = d;
        showTooltip(d, event.pageX, event.pageY);
        
        d3.select(this)
          .select("circle:nth-child(3)")
          .transition()
          .duration(150)
          .attr("stroke-width", 4);
      })
      .on("mouseleave", function() {
        hoveredNode = null;
        hideTooltip();
        
        d3.select(this)
          .select("circle:nth-child(3)")
          .transition()
          .duration(150)
          .attr("stroke-width", 2);
      });
  }
  
  // Force simulation
  const simulation = d3
    .forceSimulation(nodesCopy)
    .force(
      "link",
      d3.forceLink(linksCopy).id(d => d.id).distance(isMobile ? 45 : 35)
    )
    .force("charge", d3.forceManyBody().strength(isMobile ? -300 : -250)
      .distanceMax(400))
    .force("center", d3.forceCenter(width / 2, height / 2).strength(0.3))
    .alphaDecay(0.03);

  currentSimulation = simulation;
  
  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);
    
    node.attr("transform", d => `translate(${d.x},${d.y})`);
    labels.attr("transform", d => `translate(${d.x},${d.y})`);
    
    if (!isMobile && hoveredNode) {
      const hNode = nodesCopy.find(n => n.id === hoveredNode.id);
      if (hNode && hNode.x !== undefined && hNode.y !== undefined) {
        updateTooltipPosition(hNode.x, hNode.y);
      }
    }
  });
  
  // Initial view
  const initialScale = isMobile ? 0.6 : 0.8;
  svg.call(
    zoom.transform,
    d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(initialScale)
      .translate(-width / 2, -height / 2)
  );
  
  setupCenterButton(svg, zoom, width, height);
  setupLegend(result.degrees);
}

function showTooltip(node, x, y) {
  const tooltip = document.getElementById('tooltip');
  
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
  
  tooltip.textContent = node.title;
  tooltip.style.display = 'block';
  
  const svg = document.getElementById('graph-svg');
  const wrapper = document.querySelector('.graph-wrapper');
  const wrapperRect = wrapper.getBoundingClientRect();
  const transform = d3.zoomTransform(svg);
  
  const nodeX = node.x * transform.k + transform.x;
  const nodeY = node.y * transform.k + transform.y;
  
  const offset = isMobile ? 60 : 50;
  tooltip.style.left = `${nodeX}px`;
  tooltip.style.top = `${nodeY - offset}px`;
  
  tooltip.classList.remove('hidden');
  setTimeout(() => {
    tooltip.classList.add('visible');
  }, 10);
}

function updateTooltipPosition(x, y) {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip || tooltip.style.display === 'none') return;
  
  const svgRect = document.getElementById('graph-svg').getBoundingClientRect();
  const transform = d3.zoomTransform(document.getElementById('graph-svg'));
  
  const nodeX = x * transform.k + transform.x;
  const nodeY = y * transform.k + transform.y;
  
  const offset = isMobile ? 55 : 45;
  tooltip.style.left = `${nodeX}px`;
  tooltip.style.top = `${nodeY - offset}px`;
}

function hideTooltip() {
  const tooltip = document.getElementById('tooltip');
  
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
  }
  
  const debounceTime = isMobile ? 100 : 300;
  
  tooltipTimeout = setTimeout(() => {
    tooltip.classList.remove('visible');
    tooltip.classList.add('hidden');
    
    setTimeout(() => {
      tooltip.style.display = 'none';
    }, 150);
  }, debounceTime);
}

function setupCenterButton(svg, zoom, width, height) {
  const btn = document.getElementById('center-btn');
  
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  
  newBtn.addEventListener('click', () => {
    const initialScale = isMobile ? 0.6 : 0.8;
    svg
      .transition()
      .duration(500)
      .call(
        zoom.transform,
        d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(initialScale)
          .translate(-width / 2, -height / 2)
      );
  });
}

function setupLegend(totalDegrees) {
  const legendContainer = document.getElementById('legend-items');
  legendContainer.innerHTML = '';
  
  // Start
  const startItem = document.createElement('div');
  startItem.className = 'legend-item';
  
  const startColor = document.createElement('div');
  startColor.className = 'legend-color';
  startColor.style.backgroundColor = DEGREE_COLORS[0];
  
  const startLabel = document.createElement('span');
  startLabel.className = 'legend-label';
  startLabel.textContent = 'Start';
  
  startItem.appendChild(startColor);
  startItem.appendChild(startLabel);
  legendContainer.appendChild(startItem);
  
  // Middle degrees
  for (let i = 1; i < totalDegrees; i++) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    
    const colorDiv = document.createElement('div');
    colorDiv.className = 'legend-color';
    colorDiv.style.backgroundColor = DEGREE_COLORS[
      Math.min(i, DEGREE_COLORS.length - 1)
    ];
    
    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = `${i}°`;
    
    item.appendChild(colorDiv);
    item.appendChild(label);
    legendContainer.appendChild(item);
  }
  
  // End
  const endItem = document.createElement('div');
  endItem.className = 'legend-item';
  
  const endColor = document.createElement('div');
  endColor.className = 'legend-color';
  endColor.style.backgroundColor = END_COLOR;
  
  const endLabel = document.createElement('span');
  endLabel.className = 'legend-label';
  endLabel.textContent = 'End';
  
  endItem.appendChild(endColor);
  endItem.appendChild(endLabel);
  legendContainer.appendChild(endItem);
}

let resizeTimeout;

window.addEventListener('resize', () => {
  if (!currentGraph || !currentSimulation) return;
  
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const wasMobile = isMobile;
    isMobile = detectMobile();
    
    const container = document.querySelector(".graph-wrapper");
    if (!container) return;
    
    const { width, height } = container.getBoundingClientRect();
    const svg = d3.select("#graph-svg");
    
    if (wasMobile !== isMobile) {
      initializeGraph(currentGraph);
      return;
    }
    
    currentSimulation
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.3))
      .alpha(0.3)
      .restart();
    
    if (currentZoom) {
      const initialScale = isMobile ? 0.6 : 0.8;
      svg
        .transition()
        .duration(750)
        .call(
          currentZoom.transform,
          d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(initialScale)
            .translate(-width / 2, -height / 2)
        );
    }
  }, 250);
});
