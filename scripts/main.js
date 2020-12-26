/* File: main.js
 * Overview: This file is to support the todo list functionality.
 * It has functions to support changing the html page.
 * It has functions to support interacting with the database.
 * IndexedDB is used to store save data.
 */

/*
 * Ensure that the indexedDB functionality is valid.
 * See https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB#Creating_and_structuring_the_store
 *
 */
window.indexedDB = window.indexedDP || window.moxIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction || {READ_WRITE: "readwrite"};
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

/*
 * This section is specific for defining the functionality of dragging and dropping tasks.
 *
 */

// Define what element is being dragged around.
let draggingEle;

// Define an element to be a placeholder in the html structure.
// This way the user can see where the task will be moved to.
let placeholder;

// Determine if the user has started to move the task around.
let isDraggingStarted = false;

//The current position of mouse relative to the dragging element
x = 0;
y = 0;

// Initialize the reference to the database used throughout.
db = null;

// Create a list to store the ids being used.
id_list = [];

// This is used to grab a random character to generate an id.
alpha="ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/*********************************************************
 * General Functions
 *********************************************************/

/**
 * Swap the position of the node A and the node B.
 * This function does not care about where each node is.
 *
 * @param nodeA The node to swap.
 * @param nodeB The reference node.
 */
const swap = function(nodeA, nodeB) {

    // Get the parent of node A
    const parentA = nodeA.parentNode;

    // Determine if the sibling of A is B or not.
    const siblingA = nodeA.nextSibling === nodeB ? nodeA : nodeA.nextSibling;

    //Move `nodeA` to before the `nodeB`
    nodeB.parentNode.insertBefore(nodeA, nodeB);

    //Move `nodeB` to before the sibling of `nodeA`
    parentA.insertBefore(nodeB, siblingA);
};

/**
 * Determine if the node A is above the node B.
 *
 * @param nodeA The node in question.
 * @param nodeB The reference node.
 * @return {boolean} true if the value is above.
 */
const isAbove = function(nodeA, nodeB) {

    // Get the bounding rectangle of nodes
    const rectA = nodeA.getBoundingClientRect();
    const rectB = nodeB.getBoundingClientRect();

    // Determine if rectA is above the position of rectB.
    return (rectA.top + rectA.height / 2 < rectB.top + rectB.height / 2);
};

/**
 * Generate an id from a character and number. Add that id to the list.
 * @returns {number} The id.
 */
function getID() {
    var run = true;
    var id;
    while(run) {
        id = alpha[Math.floor(Math.random() * 26)];
        id += String(Math.floor(Math.random() * 10));
        if (!id_list.includes(id)) {
            run = false
            id_list.push(id);
        }
    }
    return id;
}

/**
 * Remove the given id from the list.
 * @param {*} id
 */
function removeID(id) {
    id = String(id);
    if (id_list.includes(id)) {
        id_list.splice(id_list.indexOf(id),1);
    }
    console.log(id + " removed");
}

/**
 * This will open the database to be used by the page. When it successfully opens, it will then call createScreen() to generate the page.
 *
 * Call this when the page is opened.
 */
function openDB() {
    var request = indexedDB.open("TaskDatabase", 1);

    request.onerror = function(event) {
        console.log("Database Failed to Open");
    }
    request.onsuccess = function(event) {
        console.log("Database opened");
        db = event.target.result;
        createScreen();
    }
    request.onupgradeneeded = function(event) {
        console.log("Database created or version updated");
        db = event.target.result;

        var osTasks = db.createObjectStore("tasks", {keyPath: "id"});
        var osLists = db.createObjectStore("lists", {keyPath: "id"});

        osTasks.createIndex("list", "list", { unique: false});

    }
}

/**
 * Open the List store and generate the lists onto the html page.
 * Once that is done, open the Tasks store and generate the tasks onto the html page.
 */
function createScreen() {

    var os_list = db.transaction("lists", "readonly").objectStore("lists");

    // An array to hold all the lists from the database.
    var list_order = [];

    // An array to hold all the tasks from the database.
    var task_order = [];
    var i = 0;

    os_list.openCursor().onsuccess = function(event) {
        var cursor = event.target.result;

        if (cursor) {
            // Add the id to the id list, as it starts empty everytime the page is loaded.
            id_list.push(cursor.value.id);
            list_order.push(cursor.value);
            cursor.continue();
        }
        else {
            console.log("Lists complete");
            // Sort the list based on position so that the first lists are on top.
            // This way the for loop can just go through the list, and build in the order of the list.
            list_order.sort((a, b) => (a.position > b.position) ? 1 : -1);
            for (i = 0; i < list_order.length; i++) {
                pageCreateList(list_order[i].id, list_order[i].name);
            }
            // Add the tasks after the list had been created.
            addTasks();
        }


    }

    /**
     * Create the tasks similarly to how the lists were created.
     *
     * To be called after the lists are created.
     */
    let addTasks = function() {
        os_task = db.transaction("tasks", "readonly").objectStore("tasks");

        os_task.openCursor().onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                // The task ids also need to be added to the list.
                id_list.push(cursor.value.id);
                task_order.push(cursor.value);
                cursor.continue();
            }
            else {
                console.log("Tasks complete");
                task_order.sort((a, b) => (a.position > b.position) ? 1 : -1);
                for (i = 0; i < task_order.length; i++) {
                    pageAddNewTask(task_order[i].id, task_order[i].task, task_order[i].resolution, task_order[i].status, document.getElementById(task_order[i].list_id));
                }
            }
        }
    }
}

/*********************************************************
 * Database Functions
 *********************************************************/

 /**
 * Update the position value for a specific task in the database.
 * @param {*} position The new position.
 * @param {*} id The id of the task.
 */
function dbUpdateTaskPosition(position, id) {
    var os = db.transaction("tasks", "readwrite").objectStore("tasks");
    var request = os.get(String(id));

    request.onerror = function(event) {
        console.log("Failed to update " + String(id));
    }

    request.onsuccess = function(event) {
        var data = event.target.result;

        data.position = position;

        var requestUpdate = os.put(data);

        requestUpdate.onerror = function(event) {
            console.log("Error on update");
        }

        requestUpdate.onsuccess = function(event) {
            console.log(String(id) + " updated to position " + position);
        }
    }
}

/**
 * Add a new task to the database. All parameters go directly into the database.
 *
 * @param {*} id
 * @param {*} position
 * @param {*} task
 * @param {*} resolution
 * @param {*} lid
 */
function dbAddNewTask(id, position, task, resolution, lid) {
    var os = db.transaction("tasks", "readwrite").objectStore("tasks");
    var request = os.add({id : id,
                            task: String(task),
                            resolution: String(resolution),
                            status: "normal",
                            position: position,
                            list_id: lid});

    request.onsuccess = function(event) {
        console.log("Data: " + id + " Added");
    }
    request.onerror = function(event) {
        console.log("Data Failed To Be Saved");
    }
}

/**
 * Remove the task from the database using the id.
 * @param {*} id
 */
function dbRemoveTask(id) {
    var os = db.transaction("tasks", "readwrite").objectStore("tasks");
    var request = os.delete(String(id));

    request.onsuccess = function(event) {
        console.log(String(id) + " was deleted");
    }
}

/**
 * Change the status of a task in the database using its id.
 * @param {*} id
 * @param {*} status
 */
function dbChangeStatus(id, status) {
    var os = db.transaction("tasks", "readwrite").objectStore("tasks");
    var request = os.get(String(id));

    request.onerror = function(event) {
        console.log("Failed to update " + String(id));
    }

    request.onsuccess = function(event) {

        // Get the current data for the id.
        var data = event.target.result;

        // Update the status value of the data.
        data.status = status;

        // Update the task in the database with the new value.
        var requestUpdate = os.put(data);

        requestUpdate.onerror = function(event) {
            console.log("Error on update");
        }

        requestUpdate.onsuccess = function(event) {
            console.log(String(id) + " updated to " + status);
        }
    }
}

/**
 * Add a new list to the database with an id, name, and position.
 * @param {*} id
 * @param {*} name
 * @param {*} position
 */
function dbCreateList(id, name, position) {
    var os = db.transaction("lists", "readwrite").objectStore("lists");
    var request = os.add({id : id,
                            name: name,
                            position: position});

    request.onsuccess = function(event) {
        console.log("List: " + id + " Added");
    }
    request.onerror = function(event) {
        console.log("List Failed To Be Saved");
    }
}

/**
 * Update the name of a list referenced by its id.
 * @param {*} id The id of the list being updated.
 * @param {*} name The new name.
 */
function dbEditListName(id, name) {
    var os = db.transaction("lists", "readwrite").objectStore("lists");
    var request = os.get(String(id));

    request.onerror = function(event) {
        console.log("Failed to update " + String(id));
    }

    request.onsuccess = function(event) {
        // Get the current data for the id.
        var data = event.target.result;

        // Update the name value of the data.
        data.name = name;

        // Update the list in the database with the new value.
        var requestUpdate = os.put(data);

        requestUpdate.onerror = function(event) {
            console.log("Error on update");
        }

        requestUpdate.onsuccess = function(event) {
            console.log(String(id) + " updated to " + name);
        }
    }
}

/**
 * Remove the specified list from the database.
 * @param {*} id The id of the list to remove.
 */
function dbDeleteList(id) {
    var os = db.transaction("lists", "readwrite").objectStore("lists");
    var request = os.delete(String(id));

    request.onsuccess = function(event) {
        console.log("List " + String(id) + " was deleted");
    }
}

/**
 * Update the position of the list in the database.
 * This will happen when a list is deleted, and all proceeding lists have to be moved up.
 * @param {*} id The id of the list being moved.
 */
function dbUpdateListPosition(id) {
    var os = db.transaction("lists", "readwrite").objectStore("lists");
    var request = os.get(String(id));

    request.onerror = function(event) {
        console.log("Failed to update " + String(id));
    }

    request.onsuccess = function(event) {

        // Get the current data for the id.
        var data = event.target.result;

        // The list is moving up one spot in the list.
        // Take its current value and subtract one to get the new position.
        data.position--;

        // Update the list in the database with the new value.
        var requestUpdate = os.put(data);

        requestUpdate.onerror = function(event) {
            console.log("Error on update");
        }

        requestUpdate.onsuccess = function(event) {
            console.log(String(id) + " updated to position " + data.position);
        }
    }
}

/**
 * Update the task description for a single task given an id of the task.
 * @param {*} id 
 * @param {*} task 
 */
function dbUpdateTask(id, task) {

    var os = db.transaction("tasks", "readwrite").objectStore("tasks");
    var request = os.get(String(id));

    request.onerror = function(event) {
        console.log("Failed to update " + String(id));
    }

    request.onsuccess = function(event) {

        // Get the current data for the id.
        var data = event.target.result;

        // Update the task value of the data.
        data.task = task;

        // Update the task in the database with the new value.
        var requestUpdate = os.put(data);

        requestUpdate.onerror = function(event) {
            console.log("Error on update");
        }

        requestUpdate.onsuccess = function(event) {
            console.log(String(id) + " updated to " + task);
        }
    }
}

/**
 * Update the resolution description of a task given an id of the task.
 * @param {*} id 
 * @param {*} resolution 
 */
function dbUpdateResolution(id, resolution) {

    var os = db.transaction("tasks", "readwrite").objectStore("tasks");
    var request = os.get(String(id));

    request.onerror = function(event) {
        console.log("Failed to update " + String(id));
    }

    request.onsuccess = function(event) {

        // Get the current data for the id.
        var data = event.target.result;

        // Update the task value of the data.
        data.resolution = resolution;

        // Update the task in the database with the new value.
        var requestUpdate = os.put(data);

        requestUpdate.onerror = function(event) {
            console.log("Error on update");
        }

        requestUpdate.onsuccess = function(event) {
            console.log(String(id) + " updated to " + resolution);
        }
    }
}

/*********************************************************
 * HTML Page Functions
 *********************************************************/

/**
 * Create a new task on the html page, giving an id, task and resoultion text, status, and its parent list.
 *
 * @param {*} ent_id
 * @param {*} ent_task
 * @param {*} ent_resolution
 * @param {*} ent_status
 * @param {*} ent_list
 */
function pageAddNewTask(ent_id, ent_task, ent_resolution, ent_status, ent_list) {
    //Create the grid block for the task.
    let block = document.createElement("div");
    block.classList.add("grid-container");

    //Create the status element.
    let status = document.createElement("div");
    status.classList.add("status");
    if (ent_status == "high") {
        status.classList.add("status-high");
    }
    else if (ent_status == "hold") {
        status.classList.add("status-hold");
    }
    else {
        status.classList.add("status-normal");
    }

    //Create status dropdown elements.
    let filler = document.createElement("div");
    filler.classList.add("filler");
    status.appendChild(filler);

    let dd = document.createElement("div");
    dd.classList.add("status-options");

    let b1 = document.createElement("button");
    b1.setAttribute("data-status", "high");
    b1.addEventListener("click", changeStatus);
    b1.setAttribute("type", "button");
    b1.innerHTML = "High";
    dd.appendChild(b1);

    b1 = document.createElement("button");
    b1.setAttribute("data-status", "normal");
    b1.addEventListener("click", changeStatus);
    b1.setAttribute("type", "button");
    b1.innerHTML = "Normal";
    dd.appendChild(b1);

    b1 = document.createElement("button");
    b1.setAttribute("data-status", "hold");
    b1.addEventListener("click", changeStatus);
    b1.setAttribute("type", "button");
    b1.innerHTML = "On Hold";
    dd.appendChild(b1);

    status.appendChild(dd);

    //Added move section
    let move = document.createElement("div");
    move.classList.add("draggable");
    move.innerHTML = "move";
    move.addEventListener('mousedown', mouseDownHandler);

    //Create the task section.
    let task = document.createElement("div");
    task.classList.add("task");
    task.setAttribute("contenteditable", "true");
    task.addEventListener("blur", updateTask);
    task.innerHTML = ent_task;

    //Create the resolution section.
    let resolution = document.createElement("div");
    resolution.classList.add("task");
    resolution.classList.add("resolution");
    resolution.setAttribute("contenteditable", "true");
    resolution.addEventListener("blur", updateResolution);
    resolution.innerHTML = ent_resolution;

    //Create the complete button section.
    let complete = document.createElement("div");
    complete.classList.add("complete");
    complete.addEventListener("click", removeTask);
    complete.innerHTML = "Complete?";

    block.appendChild(status);
    block.appendChild(move);
    block.appendChild(task);
    block.appendChild(resolution);
    block.appendChild(complete);
    block.id = ent_id;

    ent_list.children[2].appendChild(block);
}

/**
 * Remove the task from the html page.
 * @param {*} task
 */
function pageRemoveTask(task) {
    task.remove();
}

/**
 * Change the status of a task on the html page.
 * @param {*} status
 * @param {*} status_ele
 */
function pageChangeStatus(status, status_ele) {

    // Change the class of the status element. Used in conjuction with the CSS file, it will change the status
    // bar to the appropriate color.
    if (status == "high") {
        status_ele.className = "status status-high";
    }
    else if (status == "hold") {
        status_ele.className = "status status-hold";
    }
    else {
        status_ele.className = "status status-normal";
    }
}

/**
 * Add a list to the html page, with an id and name.
 * @param {*} id
 * @param {*} name
 */
function pageCreateList(id, name) {
    // This is the main list element that holds everything.
    let list = document.createElement("div");

    // The section for the header and header editing buttons.
    let header = document.createElement("div");

    let title = document.createElement("h3");
    title.innerHTML = String(name);
    title.setAttribute("contenteditable", "false");
    title.classList.add("header");

    let edit_btn = document.createElement("button");
    edit_btn.addEventListener("click", toggleEdit);
    edit_btn.innerHTML = "Edit Name";

    let del_btn = document.createElement("button");
    del_btn.addEventListener("click", askConfirmation);
    del_btn.innerHTML = "Delete?";

    // Create the button to generate new tasks for the list.
    let new_btn = document.createElement("button");
    new_btn.setAttribute("type", "button");
    new_btn.addEventListener("click", createTask);
    new_btn.classList.add("new_task");
    new_btn.innerHTML = "New Task";

    header.appendChild(title);
    header.appendChild(edit_btn);
    header.appendChild(del_btn);

    // This section is to contain the tasks. This way they will only try to swap with themselves and
    // not the header elements.
    let content = document.createElement("div");

    list.appendChild(header);
    list.appendChild(new_btn);
    list.appendChild(content);
    list.id = id;
    document.body.children[1].appendChild(list);
    console.log("New List " + id + " created!");
}


/*********************************************************
 * Event Handler Functions
 *********************************************************/

/**
 * Determine how to operate when the move button is clicked.
 *
 * @param {event} e The event.
 */
const mouseDownHandler = function(e) {

    // Set the element to be the task.
    draggingEle = e.target.parentElement;

    // Calculate the mouse position
    // Get the offset of the mouse to the element.
    const rect = draggingEle.getBoundingClientRect();
    x = e.pageX - (rect.left + window.pageXOffset);
    y = e.pageY - (rect.top + window.pageYOffset);

    // Attach the listeners to `document`/
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
};

/**
 * Determine how to operate what the task does when the mouse is moving.
 *
 * @param {event} e The event.
 */
const mouseMoveHandler = function(e) {

    // Get the size of the task.
    const draggingRect = draggingEle.getBoundingClientRect();

    // Has the user moved the task at all?
    if (!isDraggingStarted) {
        isDraggingStarted = true;

        //Let the placeholder take the height of dragging element
        //so the next element won't move up.
        placeholder = document.createElement("div");
        placeholder.classList.add("placeholder");
        draggingEle.parentNode.insertBefore(placeholder, draggingEle.nextSibling);
        placeholder.style.height = `${draggingRect.height}px`;
    }

    // Set position for dragging element
    // based on the page, as the event happens to the page.
    draggingEle.style.position = "absolute";
    draggingEle.style.top = `${e.pageY - y}px`;
    draggingEle.style.left = `${e.pageX - x}px`;

    //The current order:
    //prevEle
    //draggingEle
    //placeholder
    //nextEle
    const prevEle = draggingEle.previousElementSibling;
    const nextEle = placeholder.nextElementSibling;

    //The dragging element is above the previous element
    //User moves the dragging element to the top
    if (prevEle && isAbove(draggingEle, prevEle)) {
        swap(placeholder, draggingEle);
        swap(placeholder, prevEle);
        return;
    }

    //The dragging element is below the next element
    //User moves the dragging element to the bottom
    if (nextEle && isAbove(nextEle, draggingEle)) {
        swap(nextEle, placeholder);
        swap(nextEle, draggingEle);
    }
};

/**
 * Determine what to do when the player drops the task.
 *
 */
const mouseUpHandler = function() {

    // Take action if the user has moved the task at all.
    // - Remove the placeholder.
    // - Remove the added properties ot the task.
    if (isDraggingStarted) {
        placeholder.parentNode.removeChild(placeholder);
        draggingEle.style.removeProperty('top');
        draggingEle.style.removeProperty('left');
        draggingEle.style.removeProperty('position');
        placeholder = null;

        // Get the list which the task belongs to.
        var list = draggingEle.parentElement.children;

        // For every task in the list, recalculate their position in the list.
        var i;
        for(i = 0; i < list.length; i++) {
            dbUpdateTaskPosition(i, list[i].id);
        }
    }
    
    x = null;
    y = null;
    draggingEle = null;
    isDraggingStarted = false;
    //Remove the handlers of `mousemove` and `mouseup`.
    document.removeEventListener("mousemove", mouseMoveHandler);
    document.removeEventListener("mouseup", mouseUpHandler);
};

/**
 * The event handler called when a user clicks to create a new task.
 * @param {*} event
 */
function createTask(event) {

    // Get the element that this was called on.
    // This would be the "New Task" button.
    ele = event.target;

    // Do not create more tasks/lists than IDs can be generated.
    if (id_list.length < 259) {

        // Get and save the new id generated.
        var id = getID();
        console.log("ID generated: " + String(id));
        // Get the list that called for a new task.
        var list = ele.parentElement;

        // The task will be created at the bottom of the list, so the position value will be the same as the length of
        // the list when the task is generated.
        // The position is zero indexed.
        var pos = ele.nextElementSibling.children.length;

        dbAddNewTask(id, pos, "", "", list.id);
        pageAddNewTask(id, "", "", "normal", list);
        console.log("New Task Created!");
    }

}

/**
 * The event handler called when a user clicks to complete a task.
 * @param {*} event
 */
function removeTask(event) {

    // Get the element that this was called on.
    // This would be the "Complete?" button
    ele = event.target;

    // Get the task that was completed.
    task = ele.parentElement;
    console.log("Removing Task " + String(task.id));

    dbRemoveTask(task.id);
    pageRemoveTask(task);

    //Remove the id from the list so that it might be used later.
    removeID(task.id);
}

/**
 * The event handler when a user chooses a status of a task.
 * @param {*} event
 */
function changeStatus(event) {

    // Get the element that this was called on.
    // This would be the button from the dropdown menu.
    ele = event.target;

    // Get the status element.
    status_ele = ele.parentElement.parentElement;

    // Get what status was selected to change to.
    status = ele.getAttribute("data-status");

    // Get what task had its status changed.
    task_id = status_ele.parentElement.id;

    console.log("Changing status of " + task_id + " to " + status);
    dbChangeStatus(task_id, status);
    pageChangeStatus(status, status_ele)

}

/**
 * The event handler when a user clicks the button to create a new list.
 * @param {*} event
 */
function createList(event){
    // Get the element that this was called on.
    // This would be the "New List" button.
    ele = event.target;

    // Do not create more tasks/lists than IDs can be generated.
    if (id_list.length < 259) {
        var id = getID();
        console.log("ID generated: " + String(id));

        // The list will be created at the bottom of the page, so the position value will be the same as how ever
        // many lists there currently are.
        // The position is zero indexed.
        var pos = ele.previousElementSibling.children.length;

        dbCreateList(id, "List", pos);
        pageCreateList(id, "List");
    }


}

/**
 * The event handler when the user is editing a list name.
 * @param {*} event 
 */
function toggleEdit(event) {
    // Get the element that this was called on.
    // This would be the "Edit Name" or "Finished?" button.
    ele = event.target;

    // If list is not editable, change the state to be editing.
    // Otherwise, change back to be not editing.
    if (ele.previousElementSibling.getAttribute("contenteditable") == "false") {
        // Disable the delete button while editing is happening.
        ele.nextElementSibling.disabled = true;
        ele.previousElementSibling.classList.add("editing");
        // Allow the name to be edited right on the html page.
        ele.previousElementSibling.setAttribute("contenteditable", "true")
        ele.innerHTML = "Finish?"
    }
    else {
        // Re-enable the delete button after the name has been confirmed.
        ele.nextElementSibling.disabled = false;
        ele.previousElementSibling.classList.remove("editing");
        // Disable the editing.
        ele.previousElementSibling.setAttribute("contenteditable", "false");
        ele.innerHTML = "Edit Name";

        //Update the database with the new name.
        dbEditListName(ele.parentElement.parentElement.id, ele.previousElementSibling.innerHTML);
    }

}

/**
 * The event handler for when the user first clicks to delete the list.
 * Make the user confirm that they want to delete the list. This function updates
 * elements to support this.
 * @param {*} event 
 */
function askConfirmation(event) {

    // Get the element that this was called on.
    // This would be the "Delete?" button.
    ele = event.target;

    // Reuse the buttons that exist already

    // Change the "Edit Name" button to be the yes option.
    ele.previousElementSibling.removeEventListener("click", toggleEdit);
    ele.previousElementSibling.addEventListener("click", deleteList);
    ele.previousElementSibling.innerHTML = "Yes";

    // Change the "Delete?" button to be the no option
    ele.removeEventListener("click", askConfirmation);
    ele.addEventListener("click", rejectConfirm);
    ele.innerHTML = "No";

    // Inform the user of what they are answering yes or no to.
    text = document.createElement("span");
    text.id = "question";
    text.innerHTML = "Are you sure you want to delete?";

    // Add the text to the header section.
    ele.parentElement.appendChild(text);
}

/**
 * The event handler for when the user says "No" to deleting a list.
 * @param {*} event 
 */
function rejectConfirm(event) {

    // Get the element that this was called on.
    // This would be the "No" button.
    ele = event.target;

    // Remove the question for the page.
    document.getElementById("question").remove();

    // Change the "Yes" button back to the "Edit Name" button.
    ele.previousElementSibling.removeEventListener("click", deleteList);
    ele.previousElementSibling.addEventListener("click", toggleEdit);
    ele.previousElementSibling.innerHTML = "Edit Name";

    // Change the "No" button back to the "Delete?" button.
    ele.removeEventListener("click", rejectConfirm);
    ele.addEventListener("click", askConfirmation);
    ele.innerHTML = "Delete?";

}

/**
 * The event handler for when a user confirms the deletion of a list.
 * @param {*} event 
 */
function deleteList(event) {

    // Get the element that this was called on.
    // This would be the "Yes" button.
    ele = event.target;

    // Get the list that is being deleted.
    list = ele.parentElement.parentElement;

    // Get the section that contains all the tasks.
    var tList = list.children[2];

    // For each of the tasks that are in the list, remove them from the database.
    let i;
    for (i = 0; i < tList.children.length; i++) {
        dbRemoveTask(tList.children[i].id);
        removeID(tList.children[i].id);
    }

    // For each list that is below the list being deleted, move it up one spot.
    var next = list.nextElementSibling;
    while(next) {
        dbUpdateListPosition(next.id);
        next = next.nextElementSibling;
    }

    dbDeleteList(list.id);
    list.remove();
    removeID(list.id);

}

/**
 * The event handler for when the user changes the description of the task.
 * @param {*} event 
 */
function updateTask(event) {
    // Get the element that this was called on.
    // This would be the task div.
    ele = event.target;

    // Get the id of the task being changed.
    id = ele.parentElement.id;

    dbUpdateTask(id, ele.innerHTML)
}

/**
 * The event handler for when the user changes the description of the resolution.
 * @param {*} event 
 */
function updateResolution(event) {
    // Get the element that this was called on.
    // This would be the task div.
    ele = event.target;

    // Get the id of the task being changed.
    id = ele.parentElement.id;

    dbUpdateResolution(id, ele.innerHTML)
}

// Add the event listener to the list creator.
document.getElementById("listCreator").addEventListener("click", createList);

// Open the database.
openDB();