d3.json("flare.json").then(data => {
	////////////////////////////////////////////////////////////
	//// Setup /////////////////////////////////////////////////
	////////////////////////////////////////////////////////////
	const svg = d3.select(".chart");
	const margin = { top: 10, right: 10, bottom: 10, left: 10 };
	const svgWidth = svg.node().clientWidth;
	const width = svgWidth - margin.left - margin.right;
	const columnWidth = width / 6;
	const svgHeight = margin.top + margin.bottom;

	const linkOuterWidth = 4;
	const linkInnerWidth = 2;
	const nodeOuterWidth = 8;
	const nodeInnerWidth = 4;

	const colors = [
		"#0039A6",
		"#FF6319",
		"#6CBE45",
		"#996633",
		"#A7A9AC",
		"#FCCC0A",
		"#808183",
		"#EE352E",
		"#00933C",
		"#B933AD"
	];

	const flextree = d3.flextree;
	const layout = flextree({
		nodeSize: node => [
			node.children ? (node.children.length - 1) * linkOuterWidth : 0,
			columnWidth
		],
		spacing: 22
	});

	const linkPath = d => {
		const isEnterOrExit = d.source === d.target;
		let xOffset = 0;
		let yOffset = 0;
		if (!isEnterOrExit) {
			// Calculate offsets
			// Source max child index
			const children = d.source.children;
			const n = children.length - 1;
			// Target index
			const i = children.indexOf(d.target);
			yOffset = i - n / 2;
			// Source child sign change index
			let j = 0;
			while (
				j <= n &&
				d.source.x + (j - n / 2) * linkOuterWidth > children[j].x
			) {
				j++;
			}
			if (i < j) {
				xOffset = i - j / 2;
			} else {
				xOffset = (n - j - 1) / 2 - (i - j);
			}
		}

		// Starting point
		const x0 = d.source.y;
		const y0 = isEnterOrExit
			? d.source.x
			: d.source.x + yOffset * linkOuterWidth;
		// First corner
		const x1 = isEnterOrExit
			? d.source.y
			: (d.source.y + d.target.y) / 2 + xOffset * linkOuterWidth;
		const y1 = y0;
		// Second corner
		const x2 = x1;
		const y2 = d.target.x;
		// Ending point
		const x3 = d.target.y;
		const y3 = y2;

		const path = d3.path();
		path.moveTo(x0, y0);
		path.lineTo(x1, y1);
		path.lineTo(x2, y2);
		path.lineTo(x3, y3);
		return path.toString();
	};

	const root = layout.hierarchy(data);
	root.x0 = columnWidth / 2;
	root.y0 = 0;
	root.color = "#000";
	root.children.forEach((d, i) => (d.color = colors[i]));
	root.descendants().forEach((d, i) => {
		d.id = i;
		d._children = d.children;
		// Assign colors
		if (i > colors.length) {
			d.color = d.parent.color;
		}
	});

	// Initial collapsed state
	root.descendants().forEach(d => {
		if (d.depth && d.data.name.length !== 7) d.children = null;
	});

	svg.attr("viewBox", [0, 0, svgWidth, svgHeight]);

	const g = svg
		.append("g")
		.attr("transform", `translate(${margin.left},${margin.top})`);

	const gLink = g.append("g").attr("fill", "none");

	const gNode = g.append("g").attr("pointer-events", "all");

	////////////////////////////////////////////////////////////
	//// Render ////////////////////////////////////////////////
	////////////////////////////////////////////////////////////
	function update(source) {
		const duration = 500;
		const nodes = root.descendants().reverse();
		const links = root.links();

		// Compute the new tree layout
		layout(root);

		// Compute the new height
		let left = root;
		let right = root;
		root.eachBefore(node => {
			if (node.x < left.x) left = node;
			if (node.x > right.x) right = node;
		});
		const height = right.x - left.x;
		const svgHeight = height + margin.top + margin.bottom;

		const transition = svg
			.transition()
			.duration(duration)
			.attr("viewBox", [0, left.x, svgWidth, svgHeight]);

		// Update the nodes
		const node = gNode.selectAll("g").data(nodes, d => d.id);

		// Enter new nodes at the parent's previous position
		const nodeEnter = node
			.enter()
			.append("g")
			.attr("class", "node")
			.attr("transform", d => `translate(${source.y0},${source.x0})`)
			.attr("fill-opacity", 0)
			.attr("stroke-opacity", 0)
			.on("click", d => {
				d.children = d.children ? null : d._children;
				update(d);
			})
			.attr("cursor", d => (d._children ? "pointer" : "default"));

		nodeEnter
			.append("line")
			.attr("class", "node__line node__line--outer")
			.attr("y1", d => -d.xSize / 2)
			.attr("y2", d => d.xSize / 2)
			.attr("stroke", "#000")
			.attr("stroke-width", nodeOuterWidth)
			.clone(true)
			.attr("class", "node__line node__line--inner")
			.attr("stroke", d => (d._children ? "#fff" : "#000"))
			.attr("stroke-width", nodeInnerWidth);

		nodeEnter
			.append("text")
			.attr("class", "node__label node__label--inner")
			.attr("dy", "-0.3em")
			.attr("x", 6)
			.attr("y", d => -d.xSize / 2)
			.attr("text-anchor", "start")
			.text(d => d.data.name)
			.clone(true)
			.lower()
			.attr("class", "node__label node__label--outer")
			.attr("stroke-linejoin", "round")
			.attr("stroke-width", 3)
			.attr("stroke", "#fff");

		// Transition nodes to their new position
		const nodeUpdate = node
			.merge(nodeEnter)
			.transition(transition)
			.attr("transform", d => `translate(${d.y},${d.x})`)
			.attr("fill-opacity", 1)
			.attr("stroke-opacity", 1);

		nodeUpdate
			.selectAll(".node__line")
			.attr("y1", d => -d.xSize / 2)
			.attr("y2", d => d.xSize / 2);

		nodeUpdate.selectAll(".node__label").attr("y", d => -d.xSize / 2);

		// Transition exiting nodes to the parent's new position.
		const nodeExit = node
			.exit()
			.transition(transition)
			.remove()
			.attr("transform", d => `translate(${source.y},${source.x})`)
			.attr("fill-opacity", 0)
			.attr("stroke-opacity", 0);

		nodeExit
			.selectAll(".node__line")
			.attr("y1", d => -d.xSize / 2)
			.attr("y2", d => d.xSize / 2);

		nodeExit.selectAll(".node__label").attr("y", d => -d.xSize / 2);

		// Update the links
		const link = gLink.selectAll("g").data(links, d => d.target.id);

		// Enter any new links at the parent's previous position.
		const linkEnter = link
			.enter()
			.append("g")
			.attr("class", "link");

		linkEnter
			.append("path")
			.attr("class", "link__path link__path--outer")
			.attr("stroke-width", linkOuterWidth)
			.attr("stroke", "#fff")
			.attr("d", d => {
				const o = { x: source.x0, y: source.y0 };
				return linkPath({ source: o, target: o });
			})
			.clone(true)
			.attr("class", "link__path link__path--inner")
			.attr("stroke-width", linkInnerWidth)
			.attr("stroke", d => d.target.color);

		// Transition links to their new position.
		const linkUpdate = link.merge(linkEnter).transition(transition);

		linkUpdate.selectAll(".link__path").attr("d", linkPath);

		// Transition exiting nodes to the parent's new position.
		const linkExit = link
			.exit()
			.transition(transition)
			.remove();

		linkExit.selectAll(".link__path").attr("d", d => {
			const o = { x: source.x, y: source.y };
			return linkPath({ source: o, target: o });
		});

		// Stash the old positions for transition.
		root.eachBefore(d => {
			d.x0 = d.x;
			d.y0 = d.y;
		});
	}

	update(root);
});
