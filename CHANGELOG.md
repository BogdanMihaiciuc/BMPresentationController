# 2.8.4

Resolves an issue that caused the `Loaded` event to not fire on mashups loaded via presentation controllers.

# 2.8.3

Added a `buildDebug` build task that preserves source maps.

The `controllerWidth` and `controllerHeight` properties are now binding targets, making it possible to control the size of the windows that are displayed.

When the anchor kind is set to `Event Origin` but the controller is triggered by an event that doesn't contain coordinates, the controller's anchor will be set to the event's target element, if any.

Resolves an issue that caused the `controllerClass` property to not work with `Alert Controller` and `Confirmation Controller`.

# 2.8.2

Resolves an issue that caused mashups displayed by the presentation controllers to have incorrect styling when they had spaces in their name.

On Thingworx 9.1 and later, resolves an issue that caused mashups using the flex layouts to collapse to 0 height when displayed by the presentation controllers.

On Thingworx 9.1 and later, adds support for using the `Event Target` anchor kind with the new polymer widgets.

# 2.8

Added icons for the widgets in this package.

Update the appearance of the widget in mashup builder.

Added a new `dismissUsingEscapeKey` property that can be enabled to allow users to dismiss an active window or popover with the escape key.

Implemented the `dismiss` service at runtime which previously did nothing when invoked.

Non-modal windows will no longer keep the element they spawned from hidden after the animation runs.

# 2.6.10

Added a new `edgeInsets` property on the `Popover Controller` widget that controls the minimum spacing that will be kept between the popover's edges and the viewport edges.

# 2.6.9

Resolves a crash that occurred on browsers that didn't have `TouchEvent` defined if the triggering event was not a `MouseEvent` and the anchor property was set to `"Event Origin"`.

# 2.6.7

Updated dependecies.

# 2.6.0 Beta 7

Adds support for specifying custom classes to be added to the controller DOM nodes.

When multiple windows is enabled, parameter updates will no longer propagate to all window instances. Instead, the parameters will only be used for window creation.

# 2.6.0 Beta 3

Fixed usage of old typescriptwebpacksupport that breaks other widgets using newer versions

Fixed usage of mashups with no mashup parameters not working

Fixed bad references in the package.json file

# 2.6.0 Beta 2

Added an option to allow the creation of multiple windows from the same controller.

Support for disabling moving and/or resizing of non-modal windows.

Fixed an issue that caused controllers to not be properly destroyed.

Compatibility with Thingworx 8.5.