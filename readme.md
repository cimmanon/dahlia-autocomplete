#Dahlia Autocomplete

Yes, it's yet another JavaScript autocomplete library.  This one is different because it is built around the need for multiple form elements to be able to be sent as part of the autocomplete request, as well as multiple form elements being populated by the results.

For example, let's say you're doing a form for bar codes.  The autocomplete field would allow you to do a lookup on the product's name and the results might come back as a list of objects like `[{'barcode': 12345, 'name': 'Product Name}]`.  The barcode property could be used to populate a hidden barcode field and the field that was used to do the lookup can be ignored when it comes time to process the form.

This library was heavily inspired by [Pixabay's autocomplete library](https://github.com/Pixabay/JavaScript-autoComplete).  It's not as lightweight as Pixabay's, but it's better suited for the tasks I needed an autocompleter for.
