# ToDo
This project is an html project to locally create a todo list using html, javascript, and IndexedDB.

Since this is using IndexedDB, the list is saved on a per browser basis.  
The list does not carry over from Firefox to Chrome and vice versa.  
As well, using a private browser will not save any tasks once the browser is closed.

## Features to add
* Make the status selection nicer
    * Disable the button that represents the current status
* Create indexes for Lists and Tasks databases so that the list_order and task_order arrays aren't needed. They will already be sorted as needed.  

There is currently a limit to 260 lists and tasks.
