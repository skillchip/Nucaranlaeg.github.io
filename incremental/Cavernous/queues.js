let queues = [];
let selectedQueue = [];
let savedQueues = [];
let cursor = [0, null];

class QueueAction extends Array {
	constructor(actionID, undone = true) {
		super(actionID, undone);
	}

	get actionID() {
		return this[0];
	}

	static fromJSON(ch) {
		ch = this.migrate(ch);
		return new QueueAction(ch);
	}

	static migrate(ar) {
		if (previousVersion < 0.0304) {

		}
		return ar;
	}

}

class ActionQueue extends Array {
	constructor(...items) {
		super(...items);
	}

	static fromJSON(ar) {
		ar = this.migrate(ar);
		return ar.map((q, i) => {
			q = new ActionQueue(...q.map(e => QueueAction.fromJSON(e)));
			q.index = i;
			return q;
		});
	}

	static migrate(ar) {
		if (previousVersion < 0.0304) {

		}
		return ar;
	}

	addActionAt(actionID, index = cursor[1]) {
		if (index == null) {
			if (actionID == "B") {
				this.removeActionAt(null);
			} else if ("UDLRI<=".includes(actionID) || (actionID[0] == "N" && !isNaN(+actionID[1]))) {
				this.push(new QueueAction(actionID));
				this.queueNode.append(createActionNode(actionID));
			}
			scrollQueue(this.index, this.length);
		} else {
			if (actionID == "B") {
				this.removeActionAt(index);
			} else if ("UDLRI<=".includes(actionID) || (actionID[0] == "N" && !isNaN(+actionID[1]))) {
				if (index >= 0) {
					this.splice(index + 1, 0, new QueueAction(actionID, this[index][1]));
				} else {
					this.unshift(new QueueAction(actionID, queues[0][1]))
				}
				cursor[1]++;
			}
		}
	}

	removeActionAt(index = cursor[1]) {
		if (index == null) {
			if (this.length == 0) return;
			this.pop();
			this.queueNode.lastChild.remove();
		} else {
			if (this.length == 0 || index == -1) return;
			this.splice(index, 1);
			cursor[1]--;
		}
	}

	get queueNode() {
		let node = document.querySelector(`#queue${this.index} > .queue-inner`);
		Object.defineValue(this, 'queueNode', node);
		return node;
	}

	clear() {
		this.splice(0, this.length);
		this.queueNode.innerText = '';
	}

	fromString(string) {
		this.clear();
		let prev = '';
		for (let char of string) {
			if (prev == 'N') {
				this.addActionAt(prev + char, null);
			} else if (char != 'N') {
				this.addActionAt(char, null);
			}
			prev = char;
		}
	}

	toString() {
		return Array.from(this).map(q => {
			return isNaN(+q[0]) ? q[0] : queueToString(savedQueues[q[0]]);
		}).join("");
	}
}

function addActionToQueue(action, queue = null){
	if (document.querySelector(".saved-queue:focus, .saved-name:focus")) return addActionToSavedQueue(action);
	if (queue === null){
		for (let i = 0; i < selectedQueue.length; i++){
			addActionToQueue(action, selectedQueue[i]);
		}
		showFinalLocation();
		return;
	}
	if (queues[queue] === undefined) return;

	queues[queue].addActionAt(action, cursor[1]);

	redrawQueues();
	scrollQueue(queue, cursor[1]);
	showCursor();
}

function clearQueue(queue = null, noConfirm = false){
	if (queue === null){
		if (selectedQueue.length == 0) return;
		if (selectedQueue.length == 1) {
			clearQueue(selectedQueue[0]);
		} else {
			if (selectedQueue.length == queues.length) {
				if (!noConfirm && !confirm("Really clear ALL queues?")) return;
			} else {
				if (!noConfirm && !confirm("Really clear ALL selected queues?")) return;
			}
			for (let i = 0; i < selectedQueue.length; i++) {
				clearQueue(selectedQueue[i], true);
			}
		}
		return;
	}
	if (!noConfirm && !confirm("Really clear queue?")) return;
	queues[queue].clear();
	if (cursor[0] == queue){
		cursor[1] = null;
	}
	showCursor();
}

function createActionNode(action){
	if (!isNaN(+action)) return createQueueActionNode(action);
	let actionNode = document.querySelector("#action-template").cloneNode(true);
	actionNode.removeAttribute("id");
	let character = {
		"L": settings.useAlternateArrows ? "←" : "🡄",
		"R": settings.useAlternateArrows ? "→" : "🡆",
		"U": settings.useAlternateArrows ? "↑" : "🡅",
		"D": settings.useAlternateArrows ? "↓" : "🡇",
		"I": settings.useAlternateArrows ? "○" : "🞇",
		"<": settings.useAlternateArrows ? "⟲" : "⟲",
		"=": settings.useAlternateArrows ? "=" : "=",
	}[action];
	if (!character){
		character = runes[action[1]].icon;
	}
	actionNode.querySelector(".character").innerHTML = character;
	return actionNode;
}

function createQueueActionNode(queue){
	let actionNode = document.querySelector("#action-template").cloneNode(true);
	actionNode.removeAttribute("id");
	actionNode.style.color = savedQueues[queue].colour;
	actionNode.querySelector(".character").innerHTML = savedQueues[queue].icon;
	actionNode.setAttribute("title", savedQueues[queue].name);
	actionNode.classList.add(`action${queue}`);
	return actionNode;
}

function resetQueueHighlight(queue){
	let nodes = document.querySelectorAll(`#queue${queue} .queue-inner .started`);
	nodes.forEach(n => n.classList.remove("started"));
}

function selectQueueAction(queue, action, percent){
	let queueBlock = queuesNode.children[queue];
	let queueNode = queueBlock.querySelector('.queue-inner');
	this.width = this.width || queueNode.parentNode.clientWidth;
	let nodes = queueNode.children;
	let node = nodes[action];
	node.classList.add('started');
	if (queues[queue][action][2]){
		let complete = queues[queue][action][2].findIndex(q => q[`${queue}_${action}`] === undefined);
		percent /= queues[queue][action][2].length;
		percent += (complete / queues[queue][action][2].length) * 100;
	}
	node.style.paddingRight = `${Math.floor(16 * (100 - percent) / 100)}px`;
	let workProgressBar = queueBlock.querySelector('.work-progress');
	let lastProgess = +workProgressBar.style.width.replace("%", "");
	if (percent < lastProgess) {
		workProgressBar.style.width = "0%";
		lastProgess = 0
	}
	if (percent < lastProgess + 100/(1*60)){ // 1s@60fps
		workProgressBar.style.width = percent + "%";
	} else if (lastProgess) {
		workProgressBar.style.width = "0%";
	}
	// queueNode.parentNode.scrollLeft = Math.max(action * 16 - (this.width / 2), 0);
}

function scrollQueue(queue, action = null){
	if (action === null){
		action = queues[queue].findIndex(a => !a[1]);
	}
	let queueNode = document.querySelector(`#queue${queue} .queue-inner`);
	this.width = this.width || queueNode.parentNode.clientWidth;
	queueNode.parentNode.scrollLeft = Math.max(action * 16 - (this.width / 2), 0);
}

function redrawQueues(){
	for (let i = 0; i < queues.length; i++){
		let queueNode = document.querySelector(`#queue${i} .queue-inner`);
		while (queueNode.firstChild) {
			queueNode.removeChild(queueNode.lastChild);
		}
		for (let j = 0; j < queues[i].length; j++){
			let node = createActionNode(queues[i][j][0]);
			queueNode.append(node);
			if (!queues[i][j][1]){
				node.classList.add("started");
				node.style.paddingRight = "0";
			}
		}
	}
}

function setCursor(event, el){
	let nodes = Array.from(el.parentNode.children);
	cursor[1] = nodes.findIndex(e => e == el) - (event.offsetX < 8);
	if (nodes.length - 1 == cursor[1]) cursor[1] = null;
	cursor[0] = el.parentNode.parentNode.id.replace("queue", "");
	showCursor();
}

function maybeClearCursor(event, el){
	if (event.target == el){
		cursor[1] = null;
	}
}

function showCursor(){
	document.querySelectorAll(".cursor.visible").forEach(el => el.classList.remove("visible"));
	if (cursor[1] == null) return;
	let cursorNode = document.querySelector(`#queue${cursor[0]} .cursor`);
	if (!cursorNode){
		cursor = [0, null];
		return;
	}
	cursorNode.classList.add("visible");
	cursorNode.style.left = (cursor[1] * 16 + 17) + "px";
}

function queueToString(queue) {
	return queue.toString();
}

function exportQueues() {
	let exportString = queues.map(queue => queueToString(queue));
	navigator.clipboard.writeText(JSON.stringify(exportString));
}

function importQueues() {
	let queueString = prompt("Input your queues");
	let tempQueues = queues.slice();
	try {
		let newQueues = JSON.parse(queueString);
		if (newQueues.length > queues.length) {
			alert("Could not import queues - too many queues.")
			return;
		}
		queues.map(e => e.clear());
		for (let i = 0; i < newQueues.length; i++) {
			queues[i].fromString(newQueues[i]);
		}
		redrawQueues();
	} catch {
		alert("Could not import queues.");
		queues = tempQueues;
	}
}




Object.defineValue = function(o, name, value = name, enumerable = false) {
	if (typeof name == 'function')
		name = name.name
	return Object.defineProperty(o, name, {
		enumerable,
		configurable: true,
		writable: true,
		value
	})
}