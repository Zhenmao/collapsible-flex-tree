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

	const linkOuterWidth = 5;
	const linkInnerWidth = 2;
	const nodeOuterWidth = 8;
	const nodeInnerWidth = 4;

	const flextree = d3.flextree;
	const layout = flextree({
		nodeSize: node => [
			node.children ? node.children.length * linkOuterWidth : linkOuterWidth,
			columnWidth
		],
		spacing: 16
	});

	const diagonal = d3
		.linkHorizontal()
		.x(d => d.y)
		.y(d => d.x);

	const root = layout.hierarchy(data);
	root.x0 = columnWidth / 2;
	root.y0 = 0;
	root.descendants().forEach((d, i) => {
		d.id = i;
		d._children = d.children;
		// Initial collapsed state
		if (d.depth && d.data.name.length !== 7) d.children = null;
	});

	svg.attr("viewBox", [0, 0, svgWidth, svgHeight]);

	const g = svg
		.append("g")
		.attr("transform", `translate(${margin.left},${margin.top})`);

	const gLink = g
		.append("g")
		.attr("fill", "none")
		.attr("stroke", "#555")
		.attr("stroke-opacity", 0.4)
		.attr("stroke-width", 1.5);

	const gNode = g
		.append("g")
		.attr("cursor", "pointer")
		.attr("pointer-events", "all");

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
			.attr("transform", d => `translate(${source.y0},${source.x0})`)
			.attr("fill-opacity", 0)
			.attr("stroke-opacity", 0)
			.on("click", d => {
				d.children = d.children ? null : d._children;
				update(d);
			});

		nodeEnter
			.append("circle")
			.attr("r", 2.5)
			.attr("fill", d => (d._children ? "#555" : "#999"))
			.attr("stroke-width", 10);

		nodeEnter
			.append("text")
			.attr("dy", "0.31em")
			.attr("x", 6)
			.attr("text-anchor", "start")
			.text(d => d.data.name)
			.clone(true)
			.lower()
			.attr("stroke-linejoin", "round")
			.attr("stroke-width", 3)
			.attr("stroke", "white");

		// nodeEnter
		// 	.append("rect")
		// 	.each(d => console.log(d))
		// 	.attr("stroke", "#ccc")
		// 	.attr("fill", "none")
		// 	.attr("x", 0)
		// 	.attr("y", d => -d.xSize / 2)
		// 	.attr("width", d => d.ySize)
		// 	.attr("height", d => d.xSize);

		// Transition nodes to their new position
		const nodeUpdate = node
			.merge(nodeEnter)
			.transition(transition)
			.attr("transform", d => `translate(${d.y},${d.x})`)
			.attr("fill-opacity", 1)
			.attr("stroke-opacity", 1);

		// Transition exiting nodes to the parent's new position.
		const nodeExit = node
			.exit()
			.transition(transition)
			.remove()
			.attr("transform", d => `translate(${source.y},${source.x})`)
			.attr("fill-opacity", 0)
			.attr("stroke-opacity", 0);

		// Update the links
		const link = gLink.selectAll("path").data(links, d => d.target.id);

		// Enter any new links at the parent's previous position.
		const linkEnter = link
			.enter()
			.append("path")
			.attr("d", d => {
				const o = { x: source.x0, y: source.y0 };
				return diagonal({ source: o, target: o });
			});

		// Transition links to their new position.
		link
			.merge(linkEnter)
			.transition(transition)
			.attr("d", diagonal);

		// Transition exiting nodes to the parent's new position.
		link
			.exit()
			.transition(transition)
			.remove()
			.attr("d", d => {
				const o = { x: source.x, y: source.y };
				return diagonal({ source: o, target: o });
			});

		// Stash the old positions for transition.
		root.eachBefore(d => {
			d.x0 = d.x;
			d.y0 = d.y;
		});
	}

	update(root);
});
