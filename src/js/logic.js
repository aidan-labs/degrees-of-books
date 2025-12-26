// logic.js

let bookData = null;
let bookIndex = {
  books: new Map(),
  titleIndex: new Map(),
  allBooks: []
};

async function loadBookData() {
  try {
    const files = [
      'src/data/graph-001.json', 'src/data/graph-002.json',
      'src/data/graph-003.json', 'src/data/graph-004.json',
      'src/data/graph-005.json', 'src/data/graph-006.json',
      'src/data/graph-007.json', 'src/data/graph-008.json',
      'src/data/graph-009.json', 'src/data/graph-010.json',
      'src/data/graph-011.json', 'src/data/graph-012.json',
      'src/data/graph-013.json', 'src/data/graph-014.json'
    ];

    let allBooks = [];

    for (const file of files) {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`Failed to fetch ${file}`);
      const data = await response.json();
      allBooks.push(...data.books);
      console.log(`Loaded ${file} (${data.books.length} books)`);
    }

    bookData = { books: allBooks };

    allBooks.forEach(book => {
      bookIndex.books.set(book.book_id, book);
      bookIndex.titleIndex.set(book.title.toLowerCase(), book.book_id);
    });
    bookIndex.allBooks = allBooks;

    console.log(`All books loaded: ${allBooks.length}`);
    return bookData;
  } catch (error) {
    console.error('Error loading book data:', error);
    throw error;
  }
}

function searchBooks(query, limit = 8) {
  if (!bookIndex.allBooks || !query.trim()) return [];
  
  const lowerQuery = query.toLowerCase();
  const results = [];
  
  for (const book of bookIndex.allBooks) {
    const lowerTitle = book.title.toLowerCase();
    
    if (lowerTitle === lowerQuery) {
      results.unshift(book);
    } else if (lowerTitle.startsWith(lowerQuery)) {
      results.push(book);
    } else if (lowerTitle.includes(lowerQuery)) {
      results.push(book);
    }
    
    if (results.length >= limit * 2) break;
  }
  
  return results.slice(0, limit);
}

function getBook(bookId) {
  return bookIndex.books.get(bookId);
}

// Bidirectional BFS
function findShortestPath(startId, endId) {
  if (startId === endId) return { path: [startId], explored: 1 };
  
  const books = bookIndex.books;
  if (!books.has(startId) || !books.has(endId)) return null;
  
  let frontStart = new Set([startId]);
  let frontEnd = new Set([endId]);
  
  const parentsStart = new Map([[startId, null]]);
  const parentsEnd = new Map([[endId, null]]);
  
  let explored = 2;
  
  while (frontStart.size > 0 && frontEnd.size > 0) {
    const nextFrontStart = new Set();
    
    for (const bookId of frontStart) {
      const book = books.get(bookId);
      if (!book) continue;
      
      for (const neighbor of book.similar_books) {
        if (!books.has(neighbor)) continue;
        
        if (!parentsStart.has(neighbor)) {
          parentsStart.set(neighbor, bookId);
          nextFrontStart.add(neighbor);
          explored++;
          
          if (parentsEnd.has(neighbor)) {
            return {
              path: reconstructPath(parentsStart, parentsEnd, neighbor),
              explored
            };
          }
        }
      }
    }
    
    frontStart = nextFrontStart;
    
    const nextFrontEnd = new Set();
    
    for (const bookId of frontEnd) {
      const book = books.get(bookId);
      if (!book) continue;
      
      for (const neighbor of book.similar_books) {
        if (!books.has(neighbor)) continue;
        
        if (!parentsEnd.has(neighbor)) {
          parentsEnd.set(neighbor, bookId);
          nextFrontEnd.add(neighbor);
          explored++;
          
          if (parentsStart.has(neighbor)) {
            return {
              path: reconstructPath(parentsStart, parentsEnd, neighbor),
              explored
            };
          }
        }
      }
    }
    
    frontEnd = nextFrontEnd;
  }
  
  return null;
}

function reconstructPath(parentsStart, parentsEnd, meetingPoint) {
  const pathStart = [];
  let node = meetingPoint;
  while (node !== null) {
    pathStart.push(node);
    node = parentsStart.get(node) ?? null;
  }
  pathStart.reverse();
  
  const pathEnd = [];
  node = parentsEnd.get(meetingPoint) ?? null;
  while (node !== null) {
    pathEnd.push(node);
    node = parentsEnd.get(node) ?? null;
  }
  
  return [...pathStart, ...pathEnd];
}

function buildGraph(path, explored) {
  const nodeMap = new Map();
  const links = [];
  const linkSet = new Set();
  const pathSet = new Set(path);
  
  const degreeMap = new Map();
  path.forEach((bookId, index) => degreeMap.set(bookId, index));
  
  // Add path nodes
  path.forEach((bookId, index) => {
    const book = bookIndex.books.get(bookId);
    if (book) {
      nodeMap.set(bookId, {
        id: book.book_id,
        title: book.title,
        image_url: book.image_url,
        similar_books: book.similar_books,
        degree: index,
        isEndpoint: index === 0 || index === path.length - 1
      });
    }
  });
  
  // Add neighbors
  const maxNeighborsPerNode = 3;
  const maxTotalNeighbors = 30;
  let neighborsAdded = 0;
  
  path.forEach((bookId, pathIndex) => {
    const book = bookIndex.books.get(bookId);
    if (!book) return;
    
    let addedForThisNode = 0;
    
    for (const neighborId of book.similar_books) {
      if (neighborsAdded >= maxTotalNeighbors) break;
      if (addedForThisNode >= maxNeighborsPerNode) break;
      
      if (pathSet.has(neighborId)) continue;
      
      const neighborBook = bookIndex.books.get(neighborId);
      if (!neighborBook) continue;
      
      if (!nodeMap.has(neighborId)) {
        nodeMap.set(neighborId, {
          id: neighborBook.book_id,
          title: neighborBook.title,
          image_url: neighborBook.image_url,
          similar_books: neighborBook.similar_books,
          degree: pathIndex,
          isEndpoint: false
        });
        neighborsAdded++;
        addedForThisNode++;
      }
      
      const linkKey1 = [bookId, neighborId].sort().join('-');
      if (!linkSet.has(linkKey1)) {
        linkSet.add(linkKey1);
        links.push({ source: bookId, target: neighborId });
      }
      
      const connectsToOtherPathNode = neighborBook.similar_books.some(
        id => pathSet.has(id) && id !== bookId
      );
      
      if (connectsToOtherPathNode) {
        for (const otherId of neighborBook.similar_books) {
          if (pathSet.has(otherId) && otherId !== bookId) {
            const linkKey2 = [neighborId, otherId].sort().join('-');
            if (!linkSet.has(linkKey2)) {
              linkSet.add(linkKey2);
              links.push({ source: neighborId, target: otherId });
            }
          }
        }
      }
    }
  });
  
  // Links between path nodes
  path.forEach(bookId => {
    const book = bookIndex.books.get(bookId);
    if (!book) return;
    
    book.similar_books.forEach(neighborId => {
      if (pathSet.has(neighborId)) {
        const linkKey = [bookId, neighborId].sort().join('-');
        if (!linkSet.has(linkKey)) {
          linkSet.add(linkKey);
          const sourceDegree = degreeMap.get(bookId);
          const targetDegree = degreeMap.get(neighborId);
          if (sourceDegree < targetDegree) {
            links.push({ source: bookId, target: neighborId });
          } else {
            links.push({ source: neighborId, target: bookId });
          }
        }
      }
    });
  });
  
  // Links between non-path nodes
  const allNodeIds = Array.from(nodeMap.keys());
  allNodeIds.forEach(nodeId => {
    const node = nodeMap.get(nodeId);
    node.similar_books.forEach(neighborId => {
      if (nodeMap.has(neighborId)) {
        const linkKey = [nodeId, neighborId].sort().join('-');
        if (!linkSet.has(linkKey)) {
          linkSet.add(linkKey);
          links.push({ source: nodeId, target: neighborId });
        }
      }
    });
  });
  
  return {
    nodes: Array.from(nodeMap.values()),
    links,
    degrees: path.length - 1,
    explored
  };
}

let currentState = {
  startBook: null,
  endBook: null,
  pathResult: null,
  isSearching: false
};

function updateSearchButton() {
  const btn = document.getElementById('submit-btn');
  const canSearch = currentState.startBook && 
                   currentState.endBook && 
                   currentState.startBook.book_id !== currentState.endBook.book_id;
  btn.disabled = !canSearch || currentState.isSearching;
  btn.textContent = currentState.isSearching ? 'Finding...' : 'Go!';
}

function displayDropdown(field, results) {
  let dropdown = document.getElementById(`${field}-dropdown`);
  const inputElement = document.getElementById(`${field}-input`);
  
  if (results.length === 0) {
    dropdown.style.display = 'none';
    return;
  }
  
  dropdown.innerHTML = results.map(book => `
    <button class="dropdown-item" data-field="${field}" 
      data-book-id="${book.book_id}">
      <img 
        src="${book.image_url}" 
        alt="${book.title}"
        onerror="this.style.display='none'"
      >
      <span>${book.title}</span>
    </button>
  `).join('');
  
  if (dropdown.parentElement !== document.body) {
    document.body.appendChild(dropdown);
  }
  
  const rect = inputElement.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.top = (rect.bottom + 8) + 'px';
  dropdown.style.left = rect.left + 'px';
  dropdown.style.width = rect.width + 'px';
  dropdown.style.display = 'block';
  dropdown.style.zIndex = '10000';
  
  dropdown.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const bookId = item.dataset.bookId;
      const book = getBook(bookId);
      selectBook(book, field);
    });
  });
}

function selectBook(book, field) {
  const inputEl = document.getElementById(`${field}-input`);
  const dropdownEl = document.getElementById(`${field}-dropdown`);
  
  if (field === 'start') {
    currentState.startBook = book;
    inputEl.value = book.title;
  } else {
    currentState.endBook = book;
    inputEl.value = book.title;
  }
  
  dropdownEl.style.display = 'none';
  updateSearchButton();
}

function clearField(field) {
  const inputEl = document.getElementById(`${field}-input`);
  const dropdownEl = document.getElementById(`${field}-dropdown`);
  const clearBtn = document.getElementById(`clear-${field}`);
  
  if (field === 'start') {
    currentState.startBook = null;
  } else {
    currentState.endBook = null;
  }
  
  inputEl.value = '';
  dropdownEl.style.display = 'none';
  clearBtn.style.display = 'none';
  updateSearchButton();
}

function swapBooks() {
  const temp = currentState.startBook;
  currentState.startBook = currentState.endBook;
  currentState.endBook = temp;
  
  const startInputEl = document.getElementById('start-input');
  const endInputEl = document.getElementById('end-input');
  
  startInputEl.value = currentState.startBook ? currentState.startBook.title : '';
  endInputEl.value = currentState.endBook ? currentState.endBook.title : '';
  
  updateSearchButton();
}

function handleSearch(e) {
  if (e) e.preventDefault();
  
  if (!currentState.startBook || !currentState.endBook) return;
  
  currentState.isSearching = true;
  updateSearchButton();
  
  setTimeout(() => {
    const result = findShortestPath(
      currentState.startBook.book_id,
      currentState.endBook.book_id
    );
    
    if (!result) {
      showError('No path found between these books.');
      currentState.isSearching = false;
      updateSearchButton();
      return;
    }
    
    const graphResult = buildGraph(result.path, result.explored);
    graphResult.pathArray = result.path;
    currentState.pathResult = graphResult;
    
    displayGraph(graphResult);
    showStats(graphResult);
    updateURL();

    const graphContainer = document.getElementById('graph-container');
    if (graphContainer) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }

    currentState.isSearching = false;
    updateSearchButton();
  }, 50);
}


function updateURL() {
  if (!currentState.startBook || !currentState.endBook) return;
  
  const url = new URL(window.location);
  url.searchParams.set('start', currentState.startBook.book_id);
  url.searchParams.set('end', currentState.endBook.book_id);
  window.history.pushState({}, '', url);
}

function displayGraph(result) {
  const graphContainer = document.getElementById('graph-container');
  const emptyState = document.getElementById('empty-state');
  
  graphContainer.style.display = 'flex';
  emptyState.style.display = 'none';
  
  if (window.initializeGraph) {
    window.initializeGraph(result);
  }
}

function showError(message) {
  const errorEl = document.getElementById('error-msg');
  const statsEl = document.getElementById('stats');
  const totalBooksEl = document.getElementById('total-books');
  
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  statsEl.style.display = 'none';
  totalBooksEl.style.display = 'none';
  
  document.getElementById('graph-container').style.display = 'none';
  document.getElementById('empty-state').style.display = 'flex';
}

function showStats(result) {
  const errorEl = document.getElementById('error-msg');
  const statsEl = document.getElementById('stats');
  const totalBooksEl = document.getElementById('total-books');
  
  errorEl.style.display = 'none';
  statsEl.style.display = 'flex';
  totalBooksEl.style.display = 'none';
  
  document.getElementById('degrees-count').textContent = result.degrees;
  const plural = result.degrees !== 1 ? 's' : '';
  document.getElementById('degree-plural').textContent = plural;
  document.getElementById('explored-count').textContent = 
    result.explored.toLocaleString();
}

function copyPathToClipboard() {
  const url = window.location.href;
  
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('modal-copy-btn');
    const originalText = btn.textContent;

    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 1500);
  }).catch(console.error);
}

function getPathText() {
  if (!currentState.pathResult || !currentState.pathResult.pathArray) {
    return '';
  }

  return currentState.pathResult.pathArray
    .map(id => getBook(id)?.title ?? id)
    .join(' → ');
}

function getPathHTML() {
  if (!currentState.pathResult || !currentState.pathResult.pathArray) {
    return '';
  }

  return currentState.pathResult.pathArray
    .map(id => {
      const book = getBook(id);
      if (!book) return id;
      
      if (book.url && book.url.trim()) {
        return `<a href="${book.url}" target="_blank" 
          rel="noopener noreferrer">${book.title}</a>`;
      }
      return book.title;
    })
    .join(' → ');
}

function openShareModal() {
  const modal = document.getElementById('share-modal');
  const textEl = document.getElementById('share-path-text');

  const pathHTML = getPathHTML();
  if (!pathHTML) return;

  textEl.innerHTML = pathHTML;
  modal.style.display = 'flex';
}

function closeShareModal() {
  document.getElementById('share-modal').style.display = 'none';
}

function openAboutModal() {
  document.getElementById('about-modal').style.display = 'flex';
}

function closeAboutModal() {
  document.getElementById('about-modal').style.display = 'none';
}

function setupEventListeners() {
  document.getElementById('search-form').addEventListener('submit', handleSearch);
  
  document.getElementById('start-input').addEventListener('input', (e) => {
    const results = searchBooks(e.target.value);
    displayDropdown('start', results);
    
    const clearBtn = document.getElementById('clear-start');
    clearBtn.style.display = e.target.value ? 'block' : 'none';
    
    if (e.target.value) {
      currentState.startBook = null;
      updateSearchButton();
    }
  });
  
  document.getElementById('start-input').addEventListener('focus', (e) => {
    const results = searchBooks(e.target.value);
    if (results.length > 0) {
      displayDropdown('start', results);
    }
  });
  
  document.getElementById('clear-start').addEventListener('click', (e) => {
    e.preventDefault();
    clearField('start');
  });
  
  document.getElementById('end-input').addEventListener('input', (e) => {
    const results = searchBooks(e.target.value);
    displayDropdown('end', results);
    
    const clearBtn = document.getElementById('clear-end');
    clearBtn.style.display = e.target.value ? 'block' : 'none';
    
    if (e.target.value) {
      currentState.endBook = null;
      updateSearchButton();
    }
  });
  
  document.getElementById('end-input').addEventListener('focus', (e) => {
    const results = searchBooks(e.target.value);
    if (results.length > 0) {
      displayDropdown('end', results);
    }
  });
  
  document.getElementById('clear-end').addEventListener('click', (e) => {
    e.preventDefault();
    clearField('end');
  });
  
  document.getElementById('swap-btn').addEventListener('click', (e) => {
    e.preventDefault();
    swapBooks();
  });

  document.getElementById('share-btn').addEventListener('click', (e) => {
    e.preventDefault();
    openShareModal();
  });

  document.getElementById('close-share-modal').addEventListener('click', 
    closeShareModal);

  document.getElementById('modal-copy-btn').addEventListener('click', 
    copyPathToClipboard);

  document.getElementById('share-modal').addEventListener('click', (e) => {
    if (e.target.id === 'share-modal') {
      closeShareModal();
    }
  });

  document.getElementById('about-link').addEventListener('click', (e) => {
    e.preventDefault();
    openAboutModal();
  });

  document.getElementById('close-about-modal').addEventListener('click', 
    closeAboutModal);

  document.getElementById('about-modal').addEventListener('click', (e) => {
    if (e.target.id === 'about-modal') {
      closeAboutModal();
    }
  });
  
  document.addEventListener('click', (e) => {
    const searchWrapper = e.target.closest('.search-input-wrapper');
    const dropdown = e.target.closest('.dropdown');
    
    if (!searchWrapper && !dropdown) {
      document.getElementById('start-dropdown').style.display = 'none';
      document.getElementById('end-dropdown').style.display = 'none';
    }
  });
}

function loadFromURL() {
  const params = new URLSearchParams(window.location.search);
  const startId = params.get('start');
  const endId = params.get('end');
  
  if (!startId || !endId) return false;
  
  const startBook = getBook(startId);
  const endBook = getBook(endId);
  
  if (!startBook || !endBook) return false;
  
  currentState.startBook = startBook;
  currentState.endBook = endBook;
  
  document.getElementById('start-input').value = startBook.title;
  document.getElementById('end-input').value = endBook.title;
  
  updateSearchButton();
  
  // Auto-trigger search
  setTimeout(() => {
    document.getElementById('search-form').dispatchEvent(
      new Event('submit', { cancelable: true })
    );
  }, 100);
  
  return true;
}

async function initialize() {
  const loadingOverlay = document.getElementById('loading-overlay');
  
  try {
    await loadBookData();
    
    document.getElementById('total-books').textContent = 
      `${bookIndex.allBooks.length.toLocaleString()} books`;
    document.getElementById('total-books').style.display = 'block';
    
    setupEventListeners();
    loadFromURL();
    
    loadingOverlay.classList.add('hidden');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    loadingOverlay.innerHTML = `
      <div class="loading-content">
        <p style="color: var(--destructive); font-size: 1rem;">
          Error loading book data.
        </p>
      </div>
    `;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
