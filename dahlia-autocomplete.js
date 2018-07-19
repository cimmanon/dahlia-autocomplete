/*
elem :: HTMLElement you want the event listener added to
config :: Object (key/value pair) of configuration options

Configuration Options
---------------------

target: The element tha should be considered the target element for searching, the status indicator and search results append after it
delay: how many milliseconds should pass before making the request
minlength: the minimum number of characters that need to be typed before making the request
method: GET or POST
action: the URL the request is sent to
inputs: a list or object containing the elements that should have their values submitted during the request
outputs: a list or object containing the outputs that should be populated by the selected search result

The inputs, outputs, and action options can be configured using data attributes.
*/
// http://www.adequatelygood.com/JavaScript-Module-Pattern-In-Depth.html
var dahliaAutocomplete = function() {
	// function body that we'll actually be running
	function dahliaAutocomplete(elem, config) {
		// cache
		var results = [];
		var currentIndex = -1;
		var timer;
		var resultTimer;
		var lastVal = '';

		var xhr = new XMLHttpRequest();

		var configDefaults =
			{ 'target': elem
			, 'delay': 150
			, 'minlength': 2
			, 'method': 'GET'
			, 'action': elem.getAttribute('data-autocomplete-action')
			, 'inputs': elem.tagName.toLowerCase() == 'input' ? [elem] : elem.querySelectorAll('[data-autocomplete-input]')
			, 'outputs': elem.tagName.toLowerCase() == 'input' ? [elem] : elem.querySelectorAll('[data-autocomplete-output]')
			, 'results': new AutocompleteSuggestionsList()
			}

		// apply configuration settings
		if (typeof config === 'undefined') {
			config = configDefaults;
		} else {
			for (var k in configDefaults) {
				if (configDefaults.hasOwnProperty(k) && typeof config[k] === 'undefined') {
					config[k] = configDefaults[k];
				}
			}
		}

		var suggestions = config.results;
		var lastSelection = config.target.defaultValue;

		elem.addEventListener('focus', focusHandler, true);
		elem.addEventListener('blur', blurHandler, true);
		elem.addEventListener('keydown', keyDownHandler, true);
		elem.addEventListener('keyup', keyUpHandler, true);
		elem.addEventListener('change', function(e) {
			if (e.target !== config.target && isDataElem(e.target)) {
				processForm(config.delay);
			}
		}, false);

		// remove the onfocus initializer
		elem.onfocus = null;

		// if we're focused on the target element at initialization time, trigger the focus event
		if (document.activeElement == config.target && document.createEvent) {
			var event = document.createEvent('HTMLEvents');
			event.initEvent('focus', true, true);
			elem.dispatchEvent(event);
		}

		suggestions.results.addEventListener('click', clickHandler, true);
		suggestions.container.addEventListener('mousedown', mousedownHandler, true);
		config.target.parentNode.insertBefore(suggestions.container, config.target.nextSibling);
		// close the suggestions if we click on something other than one of our target inputs
		document.addEventListener('click', function(e) {
			if (!isDataElem(e.target)) {
				suggestions.hide();
			}
		}, false);

		var statusIndicator = document.createElement('span');
		statusIndicator.className = 'status-indicator';
		statusIndicator.style.display = 'none';
		config.target.parentNode.insertBefore(statusIndicator, suggestions.container);

		function changeStatus(s) {
			statusIndicator.style.display = '';
			statusIndicator.setAttribute('data-status', s);
		}

		function processForm(delay) {
			clearTimeout(resultTimer);
			if (delay) {
				resultTimer = setTimeout(processForm, delay);
			} else {
				if (lastVal.length >= config.minlength) {
					fetchResults();
				}
			}
		}

		function fetchResults() {
			var getParams = [];
			var fd = new FormData();
			for (var k in config.inputs) {
				if (config.inputs.hasOwnProperty(k)) {
					var field = config.inputs[k];
					var name = isNaN(k) ? k : (field.getAttribute('data-autocomplete-input') || field.name);
					// if the field is our target field, use the lastVal instead of it's value
					var val = field == config.target ? lastVal : getElemValue(field);
					if (config.method === 'POST') {
						fd.append(name, val);
					} else {
						getParams.push(name + '=' + encodeURIComponent(val));
					}
				}
			}

			try { xhr.abort(); } catch(e) {}
			xhr.open(config.method, (getParams.length ? config.action + '?' + getParams.join('&') : config.action), true);
			xhr.setRequestHeader("Accept", "application/json");
			//xhr.responseType = 'json'; // does this actually work?
			xhr.onreadystatechange = function (e) {
				if (xhr.readyState == 4) {
					if (xhr.status == 200) {
						renderResults(JSON.parse(xhr.response));
					} else {
						changeStatus('error');
					}
				}
			}
			changeStatus('loading');
			xhr.send(fd);
		}

		function renderResults(rx) {
			if (rx.length > 0) {
				statusIndicator.style.display = 'none';
				rx != results ? suggestions.populate(rx, config.target.value) : suggestions.show();
			} else {
				changeStatus('no-results');
				suggestions.truncate();
				suggestions.hide();
			}
			results = rx;
			currentIndex = -1;
		}

		function applySelection(i) {
			if (i < 0) { return; }
			var r = results[i];
			if (typeof r === 'object') {
				for (var k in config.outputs) {
					if (config.outputs.hasOwnProperty(k)) {
						var name = isNaN(k) ? k : (config.outputs[k].getAttribute('data-autocomplete-output') || config.outputs[k].name);
						config.outputs[k].value = r[name];
					}
				}
			} else {
				config.target.value = r;
			}
			if (currentIndex != i) {
				if (currentIndex >= 0) { unHighlightElement(suggestions.selectByIndex(currentIndex)); }
				currentIndex = i;
			}
			lastSelection = config.target.value;
		}

		function focusHandler(e) {
			if (isTextInput(e.target) && isDataElem(e.target)) {
				if (e.target == config.target && !results.length) {
					lastVal = e.target.value;
					processForm(config.delay);
				} else {
					suggestions.show();
				}
			}
		}

		function blurHandler(e) {
			if (!isDataElem(document.activeElement)) {
				suggestions.hide(150);
			}
		}

		// this fires before the blur event, necessary to prevent scrolling via mouse from hiding the results
		function mousedownHandler(e) {
			if (isDataElem(document.activeElement)) {
				e.preventDefault();
				return;
			}
		}

		function clickHandler(e) {
			// find out which index we are clicking on
			for (var i = 0, len = suggestions.total(); i < len; i++) {
				var currentElem = suggestions.selectByIndex(i);
				if (e.target == currentElem || currentElem.contains(e.target)) {
					applySelection(i);
					suggestions.hide();
					break;
				}
			}
		}

		function keyDownHandler(e) {
			if (isTextInput(e.target) && isDataElem(e.target)) {
				var key = window.event ? e.keyCode : e.which;

				if (key == keyDown || key == keyUp) {
					if (suggestions.total() > 0) {
						if (!suggestions.hidden()) {
							var next = key == keyDown ? nextIndex() : previousIndex();
							if (currentIndex >= 0) { unHighlightElement(suggestions.selectByIndex(currentIndex)); }
							highlightElement(suggestions.selectByIndex(next));
							currentIndex = next;
						}
						suggestions.show();
					}
					e.preventDefault();
					return false;
				} else if (key == keyEsc) {
					e.target.value = lastSelection;
					results = [];
					suggestions.truncate();
					suggestions.hide();
					e.preventDefault();
					return false;
				} else if (key == keyTab) {
					applySelection(currentIndex);
					suggestions.hide();
				} else if (key == keyEnter) {
					if (!suggestions.hidden()) {
						applySelection(currentIndex);
						suggestions.hide();
						e.preventDefault();
						return false;
					}
				}
			}
		}

		function keyUpHandler(e) {
			if (isTextInput(e.target) && isDataElem(e.target)) {
				var key = window.event ? e.keyCode : e.which;

				if (key != keyUp && key != keyDown && key != keyEsc && key != keyTab && key != keyEnter) {
					var val = e.target.value;

					if (val != lastVal) {
						lastVal = val;
						processForm(config.delay);
					}
				}
			}
		}

		function isDataElem(el) {
			// if the element is a label, look at the associated form element instead
			if (el instanceof HTMLLabelElement) {
				if (el.htmlFor) {
					el = document.getElementById(el.htmlFor);
				} else {
					el = el.querySelector('input, select, textarea');
				}
			}

			for (var k in config.inputs) {
				if (config.inputs.hasOwnProperty(k)) {
					var inputElem = config.inputs[k];
					// input element || select element || radio group
					if (inputElem === el || el.parentNode === inputElem || (inputElem instanceof HTMLCollection && contains(inputElem, el))) {
						return true;
					}
				}
			}
			return false;
		}

		function hideSuggestions() {
			suggestions.hide();
		}

		function previousIndex() { return currentIndex > 0 ? currentIndex - 1 : suggestions.total() - 1; }
		function nextIndex() { return currentIndex >= suggestions.total() - 1 ? 0 : currentIndex + 1; }

		function highlightElement(el) { el.className += ' selected'; el.scrollIntoView(false); }
		function unHighlightElement(el) { el.className = el.className.replace(selectedRegex, ''); }
	}

	// globals
	var keyTab = 9;
	var keyEnter = 13;
	var keyEsc = 27;
	var keyUp = 38;
	var keyDown = 40;

	var textualInputs = ['text', 'password', 'search', 'email', 'tel', 'url'];

	var selectedRegex = /\bselected\b/g;

	function getElemValue(el) {
		// get the value out of a radio group
		if (el instanceof HTMLCollection) {
			for (var i = 0; i < el.length; i++) {
				if (el[i].checked) {
					return el[i].value;
				}
			}
		// get the value out of an input element
		} else {
			return el.options ? el.options[el.selectedIndex].value : (el.value !== undefined ? el.value : el);
		}
	}

	function isTextInput(el) {
		return el.type && contains(textualInputs, el.type);
	}

	// https://css-tricks.com/snippets/javascript/javascript-array-contains/
	function contains(xs, v) {
		var i = xs.length;
		while (i--) {
			if (xs[i] === v) return true;
		}
		return false;
	}

	// https://stackoverflow.com/questions/22119673/find-the-closest-ancestor-element-that-has-a-specific-class
	function findAncestor(el, isValid) {
		while ((el = el.parentElement) && isValid(el));
		return el;
	}

	return dahliaAutocomplete;
}();

/*----------------------------------------------------------------------------------------------------*\
                                                                      | Formattng Helpers
\*----------------------------------------------------------------------------------------------------*/

function AutocompleteSuggestions(containerNode, collectionNode, rowFormatter) {
	this.container = containerNode;
	this.results = collectionNode;
	this.formatter = rowFormatter;
	this.timer;
	this.hide();
}
AutocompleteSuggestions.prototype.hide = function(delay) {
	if (delay && !this.timer) {
		this.timer = setTimeout(this.hide, delay);
	} else if (this.container) {
		this.container.style.display = 'none';
	}
}
AutocompleteSuggestions.prototype.show = function() {
	if (this.results.childNodes.length) {
		clearTimeout(this.timer);
		this.container.style.display = '';
	}
}
AutocompleteSuggestions.prototype.hidden = function() {
		return this.container.style.display === 'none';
}
AutocompleteSuggestions.prototype.truncate = function() {
	this.results.innerHTML = '';
}
AutocompleteSuggestions.prototype.selectByIndex = function(i) {
	return this.results.childNodes[i];
}
AutocompleteSuggestions.prototype.total = function() {
	return this.results.childNodes.length;
}
AutocompleteSuggestions.prototype.populate = function(xs, keyword) {
	this.truncate();

	if (xs.length == 0) { return; }

	for (var i = 0, len = xs.length; i < len; i++) {
		var row = this.formatter(xs[i], keyword);
		this.results.appendChild(row);
	}

	this.show();
	this.container.scrollTop = 0;
}
AutocompleteSuggestions.prototype.highlightMatches = function(haystack, needle) {
	if (typeof haystack !== 'string') { return haystack; }
	// escape special characters
	var re = new RegExp("(" + needle.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + ")", "gi");
	return haystack.replace(re, "<b>$1</b>");
}

function AutocompleteSuggestionsList(rowFormatter) {
	var ul = this.ul.cloneNode(true);

	if (typeof rowFormatter !== 'function') {
		rowFormatter = this.formatter(rowFormatter);
	}
	AutocompleteSuggestions.call(this, ul, ul, rowFormatter);
}
AutocompleteSuggestionsList.prototype = Object.create(AutocompleteSuggestions.prototype);
AutocompleteSuggestionsList.prototype.constructor = AutocompleteSuggestions;
AutocompleteSuggestionsList.prototype.ul = document.createElement('ul');
AutocompleteSuggestionsList.prototype.ul.className = 'autocomplete container results';
AutocompleteSuggestionsList.prototype.li = document.createElement('li');
AutocompleteSuggestionsList.prototype.formatter = function(displayVal) {
	return function(result, keyword) {
		var li = this.li.cloneNode(true);
		li.innerHTML = this.highlightMatches(displayVal ? result[displayVal] : result, keyword);
		return li
	}
}

function AutocompleteSuggestionsTable(headers, rowFormatter) {
	var div = this.div.cloneNode(true); // div element is needed to set overflow-y to scroll while keeping the table formatting
	var table = this.table.cloneNode(true);

	div.appendChild(table);

	if (headers.length) {
		var thead = this.thead.cloneNode(true);
		table.appendChild(thead);

		for (var i = 0, len = headers.length; i < len; i++) {
			var th = this.th.cloneNode(true);
			th.innerHTML = headers[i];
			thead.appendChild(th);
		}
	}

	var tbody = this.tbody.cloneNode(true);
	table.appendChild(tbody);

	if (typeof rowFormatter !== 'function') {
		rowFormatter = this.formatter(rowFormatter);
	}

	AutocompleteSuggestions.call(this, div, tbody, rowFormatter);
}
AutocompleteSuggestionsTable.prototype = Object.create(AutocompleteSuggestions.prototype);
AutocompleteSuggestionsTable.prototype.constructor = AutocompleteSuggestions;
AutocompleteSuggestionsTable.prototype.div = document.createElement('div');
AutocompleteSuggestionsTable.prototype.div.className = 'autocomplete container';
AutocompleteSuggestionsTable.prototype.table = document.createElement('table');
AutocompleteSuggestionsTable.prototype.table.className = 'autocomplete results';
AutocompleteSuggestionsTable.prototype.thead = document.createElement('thead');
AutocompleteSuggestionsTable.prototype.tbody = document.createElement('tbody');
AutocompleteSuggestionsTable.prototype.tr = document.createElement('tr');
AutocompleteSuggestionsTable.prototype.th = document.createElement('th');
AutocompleteSuggestionsTable.prototype.td = document.createElement('td');
// the formatter gracefully handles the case where the result is not an object
AutocompleteSuggestionsTable.prototype.formatter = function(displayVals) {
	return function(result, keyword) {
		var tr = this.tr.cloneNode(true);
		var fields = [];
		if (typeof result === 'object' && Object.keys(result).length) {
			if (displayVals) { // show only the fields specified in the array
				for (var i = 0, len = displayVals.length; i < len; i++) {
					fields.push(result[displayVals[i]]);
				}
			} else {
				for (var k in result) {
					if (result.hasOwnProperty(k)) {
						fields.push(result[k]);
					}
				}
			}
		} else {
			fields.push([keyword]);
		}

		for (var i = 0, len = fields.length; i < len; i++) {
			var val = fields[i];
			var td =  this.td.cloneNode(true);
			td.innerHTML = this.highlightMatches(val, keyword);
			tr.appendChild(td);
		}
		return tr;
	}
}
