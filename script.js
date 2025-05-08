let cy;

// holds removed edges by label
const removedEdgesMap = {};

document.getElementById('fileInput').addEventListener('change', function (event) {
	const file = event.target.files[0];
	if (file) {
		const reader = new FileReader();
		reader.onload = function (e) {
			const json = JSON.parse(e.target.result);
			renderCytoscapeGraph(json, 'cola');
			document.getElementById('tab-properties').textContent = "Select a node or edge to see its properties.";
		};
		reader.readAsText(file);
	}
});

document.getElementById('useEuler').addEventListener('click', function () {
	if (cy) {
		cy.layout({
			name: 'euler',
			animate: true
		}).run();
	}
});

document.getElementById('useCola').addEventListener('click', function () {
	if (cy) {
		cy.layout({
			name: 'cola',
			nodeSpacing: 10,
			edgeLengthVal: 45,
			animate: true,
			randomize: false,
			maxSimulationTime: 1500
		}).run();
	}
});

document.getElementById('useKlay').addEventListener('click', function () {
	if (cy) {
		cy.layout({
			name: 'klay',
			nodeDimensionsIncludeLabels: true,
			fit: true,
			padding: 20,
			animate: false,
			klay: {
				addUnnecessaryBendpoints: false,
				direction: 'DOWN',
				edgeRouting: 'ORTHOGONAL',
				thoroughness: 30
			}
		}).run();
	}
});

function hashStringToHue(str) {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 4) - hash);
	}
	return (Math.abs(hash) % 18) * 20;
}

function renderCytoscapeGraph(json, layoutName) {
	const nodes = json.elements.nodes;
	const edges = json.elements.edges;

	const nodeIds = new Set(nodes.map(node => node.data.id));
	const validEdges = edges.filter(edge =>
		nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target)
	);

	cy = cytoscape({
		container: document.getElementById('cy'),
		elements: {
			nodes: nodes,
			edges: validEdges
		},
		style: [
			{
				selector: 'node',
				style: {
					'background-color': ele => {
						const labels = ele.data('labels') || [];
						const labelStr = labels.join('-');
						const hue = hashStringToHue(labelStr);
						return `hsl(${hue}, 90%, 60%)`;
					},
					'label': 'data(id)'
				}
			},
			{
				selector: 'edge',
				style: {
					'width': 3,
					'line-fill': 'linear-gradient',
					'line-gradient-stop-colors': '#ccc #000',
					'line-gradient-stop-positions': '0% 100%',
					'label': 'data(label)',
					'font-size': 10,
					'curve-style': 'bezier',
					'text-background-opacity': 1,
					'text-background-color': '#fff',
					'text-background-shape': 'roundrectangle',
					'text-margin-y': -10
				}
			}
		],
		layout: {
			name: layoutName,
			animate: true
		}
	});

	cy.on('select', 'node, edge', event => {
		const data = event.target.data();
		const propertiesContainer = document.getElementById('properties');
		propertiesContainer.innerHTML = ''; // Clear previous content
		const table = createPropertiesTable(data);
		propertiesContainer.appendChild(table);
	});

	cy.on('unselect', () => {
		document.getElementById('properties').textContent = "Select a node or edge to see its properties.";
	});

	updateEdgeLabelCheckboxes();
}

function createPropertiesTable(data) {
	const table = document.createElement('table');
	table.style.borderCollapse = 'collapse';
	table.style.width = '100%';

	Object.entries(data).forEach(([key, value]) => {
		const row = document.createElement('tr');
		const cell = document.createElement('td');
		const keyElement = document.createElement('h3');
		const valueElement = document.createElement('div');

		// Key styling
		keyElement.textContent = key;
		keyElement.style.margin = '0';
		keyElement.style.padding = '8px 8px 0 8px';
		keyElement.style.fontSize = '1em';

		// Value rendering
		valueElement.style.margin = '0';
		valueElement.style.padding = '8px';

		if (Array.isArray(value)) {
			valueElement.appendChild(createArrayTable(value));
		} else if (typeof value === 'object' && value !== null) {
			valueElement.appendChild(createPropertiesTable(value));
		} else {
			valueElement.innerHTML = hyphenateText(value); // Apply hyphenation for strings
		}

		// Add key and value to the cell
		cell.style.border = '1px solid #ddd';
		cell.style.padding = '0'; // Remove padding between <h3> and <div>
		cell.appendChild(keyElement);
		cell.appendChild(valueElement);

		row.appendChild(cell);
		table.appendChild(row);
	});

	return table;
}

function createArrayTable(array) {
	const table = document.createElement('table');
	table.style.borderCollapse = 'collapse';
	table.style.width = '100%';

	array.forEach(item => {
		const row = document.createElement('tr');
		const cell = document.createElement('td');
		cell.style.border = '1px solid #ddd';
		cell.style.padding = '8px';

		if (Array.isArray(item)) {
			cell.appendChild(createArrayTable(item));
		} else if (typeof item === 'object' && item !== null) {
			cell.appendChild(createPropertiesTable(item));
		} else {
			cell.innerHTML = hyphenateText(item); // Apply hyphenation
		}

		row.appendChild(cell);
		table.appendChild(row);
	});

	return table;
}

function hyphenateText(text) {
	if (typeof text !== 'string') return text;
	return text.replace(/\./g, ".&#8203;"); // Insert a zero-width space after each "."
}

function updateEdgeLabelCheckboxes() {
	const container = document.getElementById('edge-filters');
	const labels = [...new Set(cy.edges().map(e => e.data('label') || ''))];
	container.innerHTML = '';
	labels.forEach(label => {
		const safe = label.replace(/[^a-z0-9]/gi, '-');
		const id = `edge-label-${safe}`;
		const li = document.createElement('li');
		const cb = document.createElement('input');
		cb.type = 'checkbox';
		cb.id = id;
		cb.checked = true;
		cb.dataset.label = label;
		cb.addEventListener('change', function () {
			const label = this.dataset.label;
			const sel = cy.edges(`[label = "${label}"]`);
			if (!this.checked) {
				// remove & store
				removedEdgesMap[label] = sel.jsons();
				cy.remove(sel);
			} else {
				// re-add & clear
				const toRestore = removedEdgesMap[label] || [];
				if (toRestore.length) {
					cy.add(toRestore);
					delete removedEdgesMap[label];
					// after adding, re-layout just these edges if needed:
					// cy.layout({ name: currentLayout, animate: true }).run();
				}
			}
		});
		const lbl = document.createElement('label');
		lbl.htmlFor = id;
		lbl.textContent = label || '(no label)';
		li.append(cb, lbl);
		container.append(li);
	});
}


// Tab‐switching logic
document.querySelectorAll('#properties .tab').forEach(tab => {
	tab.addEventListener('click', () => {
		// deactivate all tabs & panes
		document.querySelectorAll('#properties .tab').forEach(t => t.classList.remove('active'));
		document.querySelectorAll('#properties .tab-content').forEach(p => p.classList.remove('active'));
		// activate clicked tab + its pane
		tab.classList.add('active');
		document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
	});
});
