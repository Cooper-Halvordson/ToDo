//Database stuff
window.indexedDB = window.indexedDP || window.moxIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction || {READ_WRITE: "readwrite"};
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;


let draggingEle;
let placeholder;
let isDraggingStarted = false;

//The current position of mouse relative to the dragging element
x = 0;
y = 0;

//Swap two nodes
const swap = function(nodeA, nodeB) {
    const parentA = nodeA.parentNode;
    const siblingA = nodeA.nextSibling === nodeB ? nodeA : nodeA.nextSibling;

    //Move `nodeA` to before the `nodeB`
    nodeB.parentNode.insertBefore(nodeA, nodeB);

    //Move `nodeB` to before the sibling of `nodeA`
    parentA.insertBefore(nodeB, siblingA);
};

const isAbove = function(nodeA, nodeB) {
    //Get the bounding rectangle of nodes
    const rectA = nodeA.getBoundingClientRect();
    const rectB = nodeB.getBoundingClientRect();

    return (rectA.top + rectA.height / 2 < rectB.top + rectB.height / 2);
};

const mouseDownHandler = function(e) {
    draggingEle = e.target.parentElement;

    //Calculate the mouse position
    const rect = draggingEle.getBoundingClientRect();
    x = e.pageX - rect.left;
    y = e.pageY - rect.top;

    // Attach the listeners to `document`
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
};

const mouseMoveHandler = function(e) {
    const draggingRect = draggingEle.getBoundingClientRect();

    if (!isDraggingStarted) {
        isDraggingStarted = true;

        //Let the placeholder take the height of dragging element
        //so the next element won't move up.
        placeholder = document.createElement("div");
        placeholder.classList.add("placeholder");
        draggingEle.parentNode.insertBefore(placeholder, draggingEle.nextSibling);
        placeholder.style.height = `${draggingRect.height}px`;
    }

    //Set position for dragging element
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

const mouseUpHandler = function() {
    //Remove the placeholder
    
    if (isDraggingStarted) {
        placeholder.parentNode.removeChild(placeholder);
        draggingEle.style.removeProperty('top');
        draggingEle.style.removeProperty('left');
        draggingEle.style.removeProperty('position');
        placeholder = null;
    }
    
    var list = draggingEle.parentElement.children;
    x = null;
    y = null;
    draggingEle = null;
    isDraggingStarted = false;
    //Remove the handlers of `mousemove` and `mouseup`.
    document.removeEventListener("mousemove", mouseMoveHandler);
    document.removeEventListener("mouseup", mouseUpHandler);

    var i;

    for(i = 0; i < list.length; i++) {
        dbUpdateTaskPosition(i, list[i].id);
    }

};

db = null;
id_list = [];
alpha="ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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

function removeID(id) {
    id = String(id);
    if (id_list.includes(id)) {
        id_list.splice(id_list.indexOf(id),1);
    }
    console.log(id + " removed");
}

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

function createScreen() {
    var os_list = db.transaction("lists", "readonly").objectStore("lists");
    var list_order = [];
    var task_order = [];
    var i = 0;

    os_list.openCursor().onsuccess = function(event) {
        var cursor = event.target.result;    

        if (cursor) {
            console.log(cursor.value.id + " " + cursor.value.name + " " + cursor.value.position);
            id_list.push(cursor.value.id);
            list_order.push(cursor.value);
            cursor.continue();
        }
        else {
            console.log("Lists complete");
            list_order.sort((a, b) => (a.position > b.position) ? 1 : -1);
            for (i = 0; i < list_order.length; i++) {
                openCreateList(list_order[i].name, list_order[i].id);
            }
            addTasks();
        }
        
        
    }

    
    addTasks = function() {
        os_task = db.transaction("tasks", "readonly").objectStore("tasks");

        os_task.openCursor().onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                console.log(cursor.value.id + " " + cursor.value.task + " " + cursor.value.resolution + " " + cursor.value.priority + " " + cursor.value.position + " " + cursor.value.list_id);
                id_list.push(cursor.value.id);
                task_order.push(cursor.value);
                cursor.continue();
            }
            else {
                console.log("Tasks complete");
                task_order.sort((a, b) => (a.position > b.position) ? 1 : -1);
                for (i = 0; i < task_order.length; i++) {
                    openCreateTask(task_order[i].task, task_order[i].resolution, task_order[i].status, task_order[i].list_id, task_order[i].id);
                }
            }
        }
    }
    
}

function openCreateList(name, id) {
    let list = document.createElement("div");

    let header = document.createElement("div");

    let title = document.createElement("h3");
    title.innerHTML = name;
    title.setAttribute("contenteditable", "false");
    title.classList.add("header");

    let edit_btn = document.createElement("button");
    edit_btn.addEventListener("click", toggleEdit);
    edit_btn.innerHTML = "Edit Name";

    let del_btn = document.createElement("button");
    del_btn.addEventListener("click", askConfirmation);
    del_btn.innerHTML = "Delete?";

    let new_btn = document.createElement("button");
    new_btn.setAttribute("type", "button");
    new_btn.addEventListener("click", createTask);
    new_btn.classList.add("new_task");
    new_btn.innerHTML = "New Task";

    header.appendChild(title);
    header.appendChild(edit_btn);
    header.appendChild(del_btn);

    let content = document.createElement("div");

    list.appendChild(header);
    list.appendChild(new_btn);
    list.appendChild(content);
    list.id = id;
    document.body.children[2].appendChild(list);
    console.log("List " + id + " restored!");
}

function openCreateTask(old_task, old_resolution, old_status, list_id, id) {
    //Create the grid block for the task.
    let block = document.createElement("div");
    block.classList.add("grid-container");

    //Create the status element.
    let status = document.createElement("div");
    status.classList.add("status");
    if (old_status == "high") {
        status.classList.add("status-high");
    }
    else if (old_status == "hold") {
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
    task.addEventListener("blur", dbUpdateTask);
    task.innerHTML = old_task;

    //Create the resolution section.
    let resolution = document.createElement("div");
    resolution.classList.add("task");
    resolution.classList.add("resolution");
    resolution.setAttribute("contenteditable", "true");
    resolution.addEventListener("blur", dbUpdateResolution);
    resolution.innerHTML = old_resolution;

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
    block.id = id;

    document.getElementById(list_id).children[2].appendChild(block);
}

function dbAddNewTask(id, position, lid) {
    var os = db.transaction("tasks", "readwrite").objectStore("tasks");
    var request = os.add({id : id, 
                            task: "",
                            resolution: "",
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

function pageAddNewTask(list, eid) {
    //Create the grid block for the task.
    let block = document.createElement("div");
    block.classList.add("grid-container");

    //Create the status element.
    let status = document.createElement("div");
    status.classList.add("status");
    status.classList.add("status-normal");

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
    task.addEventListener("blur", dbUpdateTask);

    //Create the resolution section.
    let resolution = document.createElement("div");
    resolution.classList.add("task");
    resolution.classList.add("resolution");
    resolution.setAttribute("contenteditable", "true");
    resolution.addEventListener("blur", dbUpdateResolution);

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
    block.id = eid;

    list.children[2].appendChild(block);
}

function createTask(ele) {
    ele = ele.target;
    if (id_list.length < 259) {
        var id = getID();
        console.log("ID generated: " + String(id));
        var list = ele.parentElement;
        var list_id = list.id;
        var pos = ele.nextElementSibling.children.length;
        dbAddNewTask(id, pos, list_id);
        pageAddNewTask(list, id);
        console.log("New Task Created!");
    }

}

function pageRemoveTask(task) {
    task.remove();
}

function dbRemoveTask(id) {
    var os = db.transaction("tasks", "readwrite").objectStore("tasks");
    var request = os.delete(String(id));

    request.onsuccess = function(event) {
        console.log(String(id) + " was deleted");
    }
}

function removeTask(ele) {
    ele = ele.target;

    task = ele.parentElement;
    t_id = task.id;
    console.log("Removing Task " + String(t_id));
    dbRemoveTask(t_id);
    pageRemoveTask(task);
    removeID(t_id);
}

function dbChangeStatus(id, status) {
    var os = db.transaction("tasks", "readwrite").objectStore("tasks");
    var request = os.get(String(id));

    request.onerror = function(event) {
        console.log("Failed to update " + String(id));
    }

    request.onsuccess = function(event) {
        var data = event.target.result;

        data.status = status;

        var requestUpdate = os.put(data);

        requestUpdate.onerror = function(event) {
            console.log("Error on update");
        }

        requestUpdate.onsuccess = function(event) {
            console.log(String(id) + " updated to " + status);
        }
    }
}

function pageChangeStatus(status, status_ele) {
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

function changeStatus(ele) {
    ele = ele.target;
    status_ele = ele.parentElement.parentElement;
    status = ele.getAttribute("data-status");

    task_id = status_ele.parentElement.id;

    console.log("Changing status of " + task_id + " to " + status);
    dbChangeStatus(task_id, status);
    pageChangeStatus(status, status_ele)

}

function dbCreateList(id,name,position) {
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

function pageCreateList(id, btn) {
    let list = document.createElement("div");

    let header = document.createElement("div");

    let title = document.createElement("h3");
    title.innerHTML = "List";
    title.setAttribute("contenteditable", "false");
    title.classList.add("header");

    let edit_btn = document.createElement("button");
    edit_btn.addEventListener("click", toggleEdit);
    edit_btn.innerHTML = "Edit Name";

    let del_btn = document.createElement("button");
    del_btn.addEventListener("click", askConfirmation);
    del_btn.innerHTML = "Delete?";

    let new_btn = document.createElement("button");
    new_btn.setAttribute("type", "button");
    new_btn.addEventListener("click", createTask);
    new_btn.classList.add("new_task");
    new_btn.innerHTML = "New Task";

    header.appendChild(title);
    header.appendChild(edit_btn);
    header.appendChild(del_btn);

    let content = document.createElement("div");

    list.appendChild(header);
    list.appendChild(new_btn);
    list.appendChild(content);
    list.id = id;
    btn.previousElementSibling.appendChild(list);
    console.log("New List " + id + " created!");
}

function createList(ele){
    ele = ele.target;

    if (id_list.length < 259) {
        var id = getID();
        console.log("ID generated: " + String(id));
        var pos = ele.previousElementSibling.children.length;
        dbCreateList(id, "List", pos);
        pageCreateList(id, ele)
    }

    
}

function dbEditListName(id, name) {
    var os = db.transaction("lists", "readwrite").objectStore("lists");
    console.log(id);
    var request = os.get(String(id));

    request.onerror = function(event) {
        console.log("Failed to update " + String(id));
    }

    request.onsuccess = function(event) {
        var data = event.target.result;
        console.log(event.target);
        data.name = name;

        var requestUpdate = os.put(data);

        requestUpdate.onerror = function(event) {
            console.log("Error on update");
        }

        requestUpdate.onsuccess = function(event) {
            console.log(String(id) + " updated to " + name);
        }
    }
}

function toggleEdit(ele) {
    ele = ele.target;

    if (ele.previousElementSibling.getAttribute("contenteditable") == "false") {
        ele.nextElementSibling.disabled = true;
        ele.previousElementSibling.classList.add("editing");
        ele.previousElementSibling.setAttribute("contenteditable", "true")
        ele.innerHTML = "Finish?"
    }
    else {
        ele.nextElementSibling.disabled = false;
        ele.previousElementSibling.classList.remove("editing");
        ele.previousElementSibling.setAttribute("contenteditable", "false");
        ele.innerHTML = "Edit Name";
        dbEditListName(ele.parentElement.parentElement.id, ele.previousElementSibling.innerHTML);
    }
    
}

function askConfirmation(ele) {
    ele = ele.target;

    ele.previousElementSibling.removeEventListener("click", toggleEdit);
    ele.previousElementSibling.addEventListener("click", deleteList);
    ele.previousElementSibling.innerHTML = "Yes";

    ele.removeEventListener("click", askConfirmation);
    ele.addEventListener("click", rejectConfirm);
    ele.innerHTML = "No";

    text = document.createElement("span");
    text.id = "question";
    text.innerHTML = "Are you sure you want to delete?";

    ele.parentElement.appendChild(text);
}

function rejectConfirm(ele) {
    ele = ele.target;

    document.getElementById("question").remove();

    ele.previousElementSibling.removeEventListener("click", deleteList);
    ele.previousElementSibling.addEventListener("click", toggleEdit);
    ele.previousElementSibling.innerHTML = "Edit Name";

    ele.removeEventListener("click", rejectConfirm);
    ele.addEventListener("click", askConfirmation);
    ele.innerHTML = "Delete?";

}

function dbDeleteList(id) {
    var os = db.transaction("lists", "readwrite").objectStore("lists");
    var request = os.delete(String(id));

    request.onsuccess = function(event) {
        console.log("List " + String(id) + " was deleted");
    }
}

function dbUpdateListPosition(id) {
    var os = db.transaction("lists", "readwrite").objectStore("lists");
    var request = os.get(String(id));

    request.onerror = function(event) {
        console.log("Failed to update " + String(id));
    }

    request.onsuccess = function(event) {
        var data = event.target.result;

        console.log(data);

        data.position--;

        var requestUpdate = os.put(data);

        requestUpdate.onerror = function(event) {
            console.log("Error on update");
        }

        requestUpdate.onsuccess = function(event) {
            console.log(String(id) + " updated to position " + data.position);
        }
    }
}

function deleteList(ele) {
    ele = ele.target;
    list = ele.parentElement.parentElement;

    var tList = list.children[2];
    let i;
    for (i = 0; i < tList.children.length; i++) {
        dbRemoveTask(tList.children[i].id);
        removeID(tList.children[i].id);
    }
    var next = list.nextElementSibling;
    while(next) {
        dbUpdateListPosition(next.id);
        next = next.nextElementSibling;
    }
    dbDeleteList(list.id);
    list.remove();
    removeID(list.id);

}

function dbUpdateTask(event) {
    ele = event.target;

    id = ele.parentElement.id;
    var os = db.transaction("tasks", "readwrite").objectStore("tasks");
    var request = os.get(String(id));

    request.onerror = function(event) {
        console.log("Failed to update " + String(id));
    }

    request.onsuccess = function(event) {
        var data = event.target.result;

        data.task = ele.innerHTML;

        var requestUpdate = os.put(data);

        requestUpdate.onerror = function(event) {
            console.log("Error on update");
        }

        requestUpdate.onsuccess = function(event) {
            console.log(String(id) + " updated to " + ele.innerHTML);
        }
    }
}

function dbUpdateResolution(event) {
    ele = event.target;

    id = ele.parentElement.id;
    var os = db.transaction("tasks", "readwrite").objectStore("tasks");
    var request = os.get(String(id));

    request.onerror = function(event) {
        console.log("Failed to update " + String(id));
    }

    request.onsuccess = function(event) {
        var data = event.target.result;

        data.resolution = ele.innerHTML;

        var requestUpdate = os.put(data);

        requestUpdate.onerror = function(event) {
            console.log("Error on update");
        }

        requestUpdate.onsuccess = function(event) {
            console.log(String(id) + " updated to " + ele.innerHTML);
        }
    }
}

document.getElementById("listCreator").addEventListener("click", createList);
openDB();