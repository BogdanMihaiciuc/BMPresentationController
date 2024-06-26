////<reference path="../node_modules/bm-core-ui/lib/@types/BMCoreUI.min.d.ts"/>
///<reference path="../../BMCoreUI/build/ui/BMCoreUI/BMCoreUI.d.ts"/>

import { TWWidgetDefinition, property, canBind, didBind, TWEvent, event, service } from 'typescriptwebpacksupport/widgetruntimesupport';
import { BMPresentationControllerAnchorKind } from './shared/constants';


declare global {
    interface Window {
        BMMaterialFontsLoaded: boolean;
        BM_WINDOW_Z_INDEX_MAX: number;
    }
}

interface BMControllerWindow extends BMWindow {
    _mashup?: BMControllerMashup;

    _previousMashup?: BMControllerMashup;
}

declare var BM_WINDOW_Z_INDEX_MAX: number;

/**
 * Returns the widget with the specified id by searching the target mashup.
 * {
 * 	@param withId <String, nullable> 					Required if named is not specified. The ID of the widget to find
 * 	@param named <String, nullable>						The display name of the widget, if specified, the search will find the first widget 
 *														that has the specified id (if given) or the speficied display name.
 * 	@param inMashup <TWMashup>							The mashup object in which to search.
 * 	@param traverseContainedMashup <Boolean, nullable> 	Defaults to false. If set to true, the search will include other mashups contained within the source mashup.
 * }
 * @return <TWWidget, nullable> 						The actual widget object if found, null otherwise
 */
function BMFindWidget(args) {
	var id = args.withId;
	var mashup = args.inMashup;
	var name = args.named;
	
	if (!mashup) mashup = TW.Runtime.Workspace.Mashups.Current;
	
	return BMFindWidgetRecursive(id, name, mashup.rootWidget, args.traverseContainedMashup);
}

function BMFindWidgetRecursive(id, name, container, includeContainedMashup) {
	
	var widgets = container.getWidgets();
	var length = widgets.length;
	
	for (var i = 0; i < length; i++) {
		var widget = widgets[i];
		
		if (widget.idOfThisElement == id || widget.properties.Id == id) return widget;
		if (widget.properties.DisplayName == name) return widget;
		
		var subWidgets = widget.getWidgets();
		if (widget.properties.__TypeDisplayName == "Contained Mashup" && !includeContainedMashup) continue;
		if (subWidgets.length > 0) {
			widget = BMFindWidgetRecursive(id, name, widget, includeContainedMashup);
			
			if (widget) return widget;
		}
		
		
	}
	
	return null;
	
}

declare const Encoder: any;

interface BMControllerMashup extends TWMashup {
    BM_setParameterInternal(parameter: string, value: any);
    _BMView: BMView;
    
    /**
     * Set to `YES` if this mashup's layout is managed by `BMView`.
     */
    _BMIsViewMashup: boolean;

    closeIfPopup(): void;
}

declare class DataManager {}

/**
 * A view subclass that manages the DOMNode associated with a mashup root widget
 */
export class BMMashupView extends BMView {

    protected _contentNode!: DOMNode;

	get _supportsAutomaticIntrinsicSize(): boolean {return NO}

	// @override - BMView
    // @ts-ignore
	get contentNode() {
		return this._contentNode || this.node;
	}

	/**
	 * Constructs and returns a mashup view for the given mashup.
	 * @param mashup		The mashup.
     * @param container     If specified, the container node containing the mashup.
	 * @return				A mashup view.
	 */
	static viewForMashup(mashup: TWMashup, container?: DOMNode): BMMashupView {
		let view: BMMashupView = BMView.viewForNode.call(this, container || mashup.rootWidget.boundingBox[0]) as BMMashupView;

		view._contentNode = mashup.rootWidget.jqElement[0];

		return view;
	}

}

let BMControllerSerialVersion = 0;

@TWWidgetDefinition export class BMControllerBase extends TWRuntimeWidget implements BMWindowDelegate {

    /**
     * The kind of anchor to use.
     */
    @property anchorKind: BMPresentationControllerAnchorKind;

    /**
     * The anchor selector, for `Widget` and `Selector` anchor kinds.
     */
    @property anchor: string;

    _mashupName: string;
    @property set mashupName(mashup: string) {
        if (mashup == this._mashupName) return;

        this._mashupName = mashup;

        this.loadMashupDefinitionWithName(mashup);
    }

    /**
     * The controller instance.
     */
    controllers: BMControllerWindow[] = [];

    /**
     * Adds a controller to this presentation controller.
     * @param controller    The controller to add.
     */
    protected addController(controller: BMControllerWindow) {
        this.controllers.push(controller);
    }

    /**
     * Destroys and removes the given controller.
     * @param controller    The controller to remove.
     */
    protected removeController(controller: BMControllerWindow) {
        let index;
        if ((index = this.controllers.indexOf(controller)) != -1) {
            this.destroyMashupForController(controller);
            controller.release();
            this.controllers.splice(index, 1);
        }
    }

    _parameters: any;

    _previousMashupInstance?: BMControllerMashup;

    _mashupDefinition: TWMashupEntityDefinition;

    /**
     * The controller's width.
     */
    @property controllerWidth: number;

    /**
     * The controller's height.
     */
    @property controllerHeight: number;

    /**
     * One or more CSS classes to add to the controller DOM node.
     */
    @property set controllerClass(CSSClass: string) {
        if (!this.getProperty('multipleWindows')) {
            const controller = this.controllers[0];
            controller.CSSClass = CSSClass || '';
        }
    }

    /**
     * One or more CSS classes to add to the controller overlay DOM node.
     */
    @property overlayClass: string;

    /**
     * When set to `YES`, the windows managed by this controller can be dismissed using the escape key.
     */
    @property dismissUsingEscapeKey: boolean;

    /**
     * When set to `YES`, the modal windows managed by this controller can be dismissed by clicking outside.
     */
    @property dismissUsingOutsideClick: boolean;

    /**
     * When set to `YES`, the windows managed by this controller will have their color scheme set to `.Auto`.
     * Otherwise their color scheme is set to `.Light`.
     */
    @property matchesSystemColorScheme: boolean;

    /**
     * The anchor node, if it exists.
     */
    anchorNode?: DOMNode;

    /**
     * The anchor point, if it exists.
     */
    anchorPoint?: BMPoint;

    /**
     * The anchor rect, if it exists.
     */
    anchorRect?: BMRect;
    
    /**
     * A promise that is resolved when the mashup definition has loaded.
     */
    protected mashupDefinitionPromise: Promise<void>;

    /**
     * Retrieves and caches the definition for the given mashup.
     * If the mashup definition is already cached, it is returned synchronously.
     * If this mashup definition is requested asynchronously while there is already a pending request for this mashup,
     * a new request will not be created. Instead, the completion handler will be added to the already existing request.
     * @param name <String>																				The name of the mashup whose definition to retrieve.
     * {
     *  @param completionHandler <void ^(nullable TWMashupDefinition, nullable error), nullable>		A completion handler to invoke when the mashup definition was retrieved or an error occurs.
     * 																									The handler returns nothing and receives two parameters:
     * 																										- The mashup definition if it could be retrieved
     * 																										- The error if the mashup definition could not be retrieved
     * }
     * @return <TWMashupDefinition, nullable OR Promise>												The mashup definition if the request was atomic and it could be retrieved,
     * 																									undefined otherwise. 
     * 																									If the request is nonatomic, this function will return a promise that resolves when the request completes.
     */
    private loadMashupDefinitionWithName(name: string, args: {completionHandler?: (mashup?: (TWMashupEntityDefinition | undefined), error?: (Error | undefined)) => void} = {}): Promise<TWMashupEntityDefinition> {
        var request;
        var promise;

        // If the request is nonatomic and there isn't already a pending request, create it now
        request = new XMLHttpRequest();

        // Wrap the callback in a callback collection to allow multiple requests to the same mashup to execute together
        request._BMCallbackCollection = BMFunctionCollectionMake();

        // Create a promise that will be returned by this function, allowing this function to be awaited for in async functions
        request._BMPromise = new Promise(function (resolve, reject) {
            request._BMResolve = resolve;
            request._BMReject = reject;
        });
        promise = request._BMPromise;

        // Push the callback into the callback collection
        if (args.completionHandler) {
            request._BMCallbackCollection.push(args.completionHandler);
        }
        
        request.open('GET', "/Thingworx/Mashups/" + TW.encodeEntityName(name), YES);
        
        request.setRequestHeader('Content-Type', 'application/json');
        request.setRequestHeader('Accept', 'application/json');
        request.setRequestHeader('x-thingworx-session', 'true');
        
        // This will hold the actual mashup object once the XHR finishes loading
        var mashupDefinition;

        const self = this;
        
        request.onload = function (data) {
            if (this.status == 200) {
                mashupDefinition = JSON.parse(request.responseText);
                
                // Then invoke the completion handler
                this._BMCallbackCollection(mashupDefinition);

                // Resolve the promise
                this._BMResolve && this._BMResolve(mashupDefinition);

                self.mashupDefinitionDidLoad(mashupDefinition);
            }
            else {
                var error = new Error('The mashup could not be loaded. The server returned status code ' + this.status);
                this._BMCallbackCollection(undefined, error);
                this._BMReject && this._BMReject(error);
                

            }
        };
        
        request.onerror = function (error) {
            TW.Runtime.showStatusText('permission-error', 'Could not load "' + Encoder.htmlEncode(name) + '". Reason: ' + request.status + ' - ' + request.responseText, true);
            this._BMCallbackCollection(undefined, error);
            this._BMReject && this._BMReject(error);
        };
        
        this.mashupDefinitionPromise = request._BMPromise;

        request.send();
        return promise;
    }


    protected mashupDefinitionDidLoad(definition: TWMashupEntityDefinition) {
        this._mashupDefinition = definition;
    }

	/**
	 * Causes this cell to render and display the given mashup, if it corresponds to the mashup that this cell manages,
	 * otherwise this method does nothing.
	 * If this cell is already managing a mashup when this method is invoked, that mashup will be destroyed before the new one is created.
	 * If this cell is in a recycled state when this method is invoked, mashup rendering will be deferred to <code>prepareForDisplay()</code>
	 * @param named <String>							The name of the mashup to render.
	 * {
	 * 	@param withDefinition <TWMashupDefinition>		The mashup definition object.
     *  @param intoController                           The controller in which the mashup will be rendered.
	 * }
     * @return                                          The mashup instance.
	 */
	protected renderMashupNamed(named: string, args: {withDefinition: TWMashupEntityDefinition, intoController: BMControllerWindow}): TWMashup {
		// Don't do anything if this mashup no longer corresponds to this cell's mashup
		if (named != this.mashupName) return;

		this._mashupDefinition = args.withDefinition;
        let definition = args.withDefinition;
        
        const controller = args.intoController;

		// Destroy the current mashup if there is one
		if (controller._mashup) {
			controller._previousMashup = controller._mashup;
		}

		var self = this;

		// Save a reference to the currently loaded mashup and its HTML ID so it can be restored afterwards
		var currentHTMLID = TW.Runtime.HtmlIdOfCurrentlyLoadedMashup;
		var currentMashup = TW.Runtime.Workspace.Mashups.Current;
		
		// A new container has to be created for the mashup
		// because it gets removed when the mashup is destroyed
		var containerNode: HTMLDivElement = document.createElement('div');
		containerNode.classList.add('BMControllerMashup', 'mashup-popup');
		args.intoController.contentView.node.appendChild(containerNode);
		var container: JQuery = $(containerNode);

		// If there was a previous mashup that should be destroyed,
		// the new mashup starts out transparent
		if (this._previousMashupInstance) {
			containerNode.style.opacity = '.0000';
		}
		
		// Increment the mashup serial version to generate a unique ID for this mashup
		BMControllerSerialVersion++;
		
		var mashupContent = definition.mashupContent;
		
		// Construct the mashup object and its associated data object
		var mashup = new TW.MashupDefinition() as BMControllerMashup;
		controller._mashup = mashup;
		
		mashup.dataMgr = new DataManager() as TWDataManager;
		
		// Set up the unique IDs
		// Replace dots and spaces with underscores so they don't throw off the jQuery selectors used by Thingworx
		mashup.rootName = definition.name.replace(/\./g, '_').replace(/\s/g, '_') + '-BMController-' + BMControllerSerialVersion;
		container.attr('id', mashup.rootName);
		mashup.htmlIdOfMashup = '#' + mashup.rootName;
		TW.Runtime.HtmlIdOfCurrentlyLoadedMashup = mashup.htmlIdOfMashup;
		
		mashup.mashupName = definition.name;
		
		// Trigger the mashup load
		mashup.loadFromJSON(mashupContent, definition);
		
		// Construct the bindings
		mashup.dataMgr.migrateAnyBindings(mashup);
		TW.Runtime.Workspace.Mashups.Current = mashup;

        // If the root widget of the new mashup is a view, attach it as a subview of the cell
        let rootWidget = controller._mashup.rootWidget.getWidgets()[0] as any;

        // Prevent the root view from initiating a layout pass before this cell is ready for display
        if (rootWidget && rootWidget.coreUIView) {
            rootWidget._skipInitialLayoutPass = YES;
        }
        
        // Otherwise draw the mashup into the container using the standard Thingworx method
        mashup.rootWidget.appendTo(container, mashup);

		// Create the data manager
        // As of Thingworx 9.2.8 and 9.3.3, the manager waits for a group of promises that
        // appears to always be blank; in these cases make the promise synchronous
        const _all = Promise.all;
        Promise.all = function (promises) {
            // When the promises is an empty array, fire then immediately
            if (!promises?.length) {
                return {
                    then(callback) {
                        callback([]);
                    }
                }
            }
            return _all.apply(Promise, arguments);
        }
		const dataMgrLoadResult = mashup.dataMgr.loadFromMashup(mashup);
        Promise.all = _all;

        // If the root widget of the new mashup is a view, attach it as a subview of the cell
        // Create a view for the mashup widget and add the root view as a sub-widget
        if (rootWidget && rootWidget.coreUIView) {
            let mashupView: BMMashupView = BMMashupView.viewForMashup(mashup, containerNode);
            mashup._BMView = mashupView;
            args.intoController.contentView.addSubview(mashupView, {toPosition: 0});

            let rootView: BMView = rootWidget.coreUIView;
            mashupView.addSubview(rootView);

            // Additionally, the root widget is to be added a subview to the mashup view with a set of constraints
            BMLayoutConstraint.constraintWithView(rootView, {attribute: BMLayoutAttribute.Left, toView: mashupView, secondAttribute: BMLayoutAttribute.Left}).isActive = YES;
            BMLayoutConstraint.constraintWithView(rootView, {attribute: BMLayoutAttribute.Top, toView: mashupView, secondAttribute: BMLayoutAttribute.Top}).isActive = YES;
            BMLayoutConstraint.constraintWithView(rootView, {attribute: BMLayoutAttribute.Width, toView: mashupView, relatedBy: BMLayoutConstraintRelation.Equals, secondAttribute: BMLayoutAttribute.Width}).isActive = YES;
            BMLayoutConstraint.constraintWithView(rootView, {attribute: BMLayoutAttribute.Height, toView: mashupView, relatedBy: BMLayoutConstraintRelation.Equals, secondAttribute: BMLayoutAttribute.Height}).isActive = YES;

            // Similarly, the mashup root widget has to be linked to the cell
            BMLayoutConstraint.constraintWithView(mashupView, {attribute: BMLayoutAttribute.Left, toView: args.intoController.contentView, secondAttribute: BMLayoutAttribute.Left}).isActive = YES;
            BMLayoutConstraint.constraintWithView(mashupView, {attribute: BMLayoutAttribute.Top, toView: args.intoController.contentView, secondAttribute: BMLayoutAttribute.Top}).isActive = YES;
            BMLayoutConstraint.constraintWithView(mashupView, {attribute: BMLayoutAttribute.Width, toView: args.intoController.contentView, relatedBy: BMLayoutConstraintRelation.Equals, secondAttribute: BMLayoutAttribute.Width}).isActive = YES;
            BMLayoutConstraint.constraintWithView(mashupView, {attribute: BMLayoutAttribute.Height, toView: args.intoController.contentView, relatedBy: BMLayoutConstraintRelation.Equals, secondAttribute: BMLayoutAttribute.Height}).isActive = YES;


            mashup._BMIsViewMashup = YES;
        }
        else {
            mashup._BMIsViewMashup = NO;
        }
		
		(mashup as any).parameterDefinitions = (definition as any).parameterDefinitions;
		
		// Store a reference to this mashup in the container's data dictionary
		container.data('mashup', mashup);

		// Add a hook into setParameter, to allow data updates; set this up after providing the initial values to parameters
		mashup.BM_setParameterInternal = mashup.setParameter;
		mashup.setParameter = function (key, value) {
			// Allow the mashup to update the parameter internally
			this.BM_setParameterInternal(key, value);
			
			// Otherwise publish the update to the data property
			self._parameters[key] = value;
            
            if (self.controllers.length == 1 && self.controllers[0] == controller) {
                // Dispatch a property update to the Thingworx runtime, if this is the
                // single open window
                self.setProperty(key, value);
            }
			
        };
        
        mashup.rootWidget.closeIfPopup = function () {
            args.intoController.dismissAnimated(YES, {toNode: self.anchorNode, toRect: self.anchorRect});
        }

        // As of Thingworx 9.2.8 and 9.3.3, data manager loading is async and it is required to wait for it
        // before firing the loaded event or setting parameters
        if (dataMgrLoadResult instanceof Promise) {
            dataMgrLoadResult.then(() => {
                // Set up the parameter values
                if (self._parameters) self._setParametersInternalForController(controller);
                
                // Fire the MashupLoaded event to signal that loading is complete
                mashup.fireMashupLoadedEvent();
            });
        }
        else {
            // Set up the parameter values
            if (self._parameters) self._setParametersInternalForController(controller);
            
            // Fire the MashupLoaded event to signal that loading is complete
            mashup.fireMashupLoadedEvent();
        }
		
        
        // Restore the previous mashup ID and object
        TW.Runtime.HtmlIdOfCurrentlyLoadedMashup = currentHTMLID;
		TW.Runtime.Workspace.Mashups.Current = currentMashup;
		
		// If there was a previous mashup that should be destroyed, run an animation and then destroy it
		if (this._previousMashupInstance) {
			let previousMashupInstance = this._previousMashupInstance;
            this._previousMashupInstance = undefined;
            previousMashupInstance.destroyMashup();
            if (previousMashupInstance._BMView) {
                previousMashupInstance._BMView.release();
            }
        }
        
        return mashup;
    }

    /**
     * Creates the mashup for this controller. The `controller` property must be an instance of
     * `BMWindow` when this method is invoked.
     */
    protected createMashupForController(controller: BMControllerWindow): TWMashup {
        return this.renderMashupNamed(this.mashupName, {withDefinition: this._mashupDefinition, intoController: controller});
    }
    
    /**
     * Destroys the current mashup.
     */
    protected destroyMashupForController(controller: BMControllerWindow): void {
        if (controller._mashup) {
            controller._mashup.destroyMashup();
            controller._mashup = undefined;
        }
    }

	/**
	 * Invoked internally by the mashup cell to update the managed mashup's parameters
	 * to the values currently used by the cell.
	 */
	_setParametersInternalForController(controller: BMControllerWindow): void {

		var mashup = controller._mashup;
		if (mashup && this._parameters) {
			for (var parameter in this._parameters) {
				mashup.BM_setParameterInternal(parameter, this._parameters[parameter]);
			}
		}
    }
    
    _mashupParameters: Dictionary<any>;

    // @override - TWRuntimeWidget
    renderHtml(): string {
        return `<div class="widget-content"></div>`;
    };

    // @override - TWRuntimeWidget
    async afterRender(): Promise<void> {
        require('./styles/runtime.css');

        // As of Thingworx 8.5, the default z-index for mashups has changed from 1500 to 9999.
        // This extreme z-index value for BMWindow reflects this change.
        BM_WINDOW_Z_INDEX_MAX = 10_500;

        // TODO: Need a better way to include this, ideally the toolbar buttons should just
        // be regular images instead of font icons
        if (!window.BMMaterialFontsLoaded) {
            window.BMMaterialFontsLoaded = YES;
            
            $('head').append('<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">');
            BMWindow.registerShowcaseElement({node: document.querySelector('#runtime-workspace'), get frame() {return BMRectMake(0, 0, window.innerWidth, window.innerHeight)}});
        }

        this.boundingBox[0].style.display = 'none';

        this._parameters = {};
        try {
            this._mashupParameters = JSON.parse(this.getProperty('_mashupFields'));
        } catch (ex) {
            // if the mashup had no mashup params, then just initialize an empty object
            this._mashupParameters = {};
        }
        for (const key in this._mashupParameters) {
            this._parameters[key] = this.getProperty(key);
        }

        // Preload the mashup
        if (this.mashupName) {
            this._mashupName = this.mashupName;
            this.loadMashupDefinitionWithName(this.mashupName);
        }
    }

    updateProperty(info: TWUpdatePropertyInfo) {
        super.updateProperty(info);
        if (info.TargetProperty in this._mashupParameters) {
            let value = info.RawSinglePropertyValue || info.SinglePropertyValue;
            this._parameters[info.TargetProperty] = value;
            this.setProperty(info.TargetProperty, value);

            // It doesn't make much sense to sync the properties of a set of windows, so updates will only
            // happen when there a single window open
            if (!this.getProperty('multipleWindows')) {
                const controller = this.controllers[0];
                if (controller._mashup) {
                    controller._mashup.BM_setParameterInternal(info.TargetProperty, value);
                }
            }
        }
    }

    /**
     * Triggered upon the controller closing.
     */
    @event controllerDidClose: TWEvent;

    /**
     * Dismisses this controller.
     */
    @service dismiss() {
        if (this.controllers.length) {
            for (const controller of this.controllers.slice()) {
                controller.dismissAnimated(YES);
            }
        }
    }

    protected registerKeyboardShortcutForWindow(window: BMWindow) {
        const keyboardShortcut = BMKeyboardShortcut.keyboardShortcutWithKeyCode('Escape', {modifiers: [], target: this, action: 'dismiss'});
        keyboardShortcut.preventsDefault = YES;
        window.registerKeyboardShortcut(keyboardShortcut);
    }

    windowShouldClose(window: BMWindow): boolean {
        return this.getProperty('dismissUsingOutsideClick', YES);
    }

    windowWillClose(window: BMWindow) {
        this.controllerDidClose();
    }

    windowDidClose(window: BMControllerWindow) {
        if (window._mashup) {
            window._mashup.destroyMashup();
            window._mashup = undefined;
        }
        window.release();
        this.controllers.splice(this.controllers.indexOf(window), 1);
    }

    windowDidResize(window: BMControllerWindow) {
        if (window._mashup && !window._mashup._BMIsViewMashup) {
            window._mashup.rootWidget.handleResponsiveWidgets(YES);
        }
    }

    windowDidEnterFullScreen(window: BMControllerWindow) {
        if (window._mashup && !window._mashup._BMIsViewMashup) {
            window._mashup.rootWidget.handleResponsiveWidgets(YES);
        }
    }

    windowDidExitFullScreen(window: BMControllerWindow) {
        if (window._mashup && !window._mashup._BMIsViewMashup) {
            window._mashup.rootWidget.handleResponsiveWidgets(YES);
        }
    }

    // @override - TWRuntimeWidget
    beforeDestroy?(): void {
        for (const controller of this.controllers) {
            this.destroyMashupForController(controller);
            controller.release();
        }
    }
}

@TWWidgetDefinition export class BMPopoverController extends BMControllerBase implements BMWindowDelegate {

    @property edgeInsets: number;

    @property permittedDirections: string;

    @property borderRadius?: number;

    @property indicatorSize?: number;

    @service async bringToFront() {
        // If this popover is already open, cancel this request
        if (this.controllers.length) return;

        const popover = BMPopover.popoverWithSize(BMSizeMake(this.controllerWidth || 400, this.controllerHeight || 400));
        popover.permittedDirections = JSON.parse(this.permittedDirections ?? '["Top", "Bottom", "Left", "Right"]');
        popover.borderRadius = this.borderRadius ?? 4;
        popover.indicatorSize = this.indicatorSize ?? 16;
        popover.edgeInsets = BMInsetMakeWithEqualInsets(this.edgeInsets || 0);
        if (this.controllerClass) {
            popover.CSSClass = this.controllerClass;
        }
        if (this.overlayClass && popover.superview) {
            popover.superview.CSSClass = this.overlayClass;
        }

        if (!this.getProperty('matchesSystemColorScheme', YES)) {
            popover.colorScheme = BMViewColorScheme.Light;
        }

        this.registerKeyboardShortcutForWindow(popover);

        switch (this.anchorKind) {
            case BMPresentationControllerAnchorKind.None:
                // None is not really supported for popovers. This will default to the event origin
            case BMPresentationControllerAnchorKind.EventOrigin:
                // For event, only mouse and touch events are supported as other event kinds don't
                // provide appropriate coordinates
                if (window.event) {
                    if (window.event instanceof MouseEvent) {
                        const event = window.event as MouseEvent;
                        popover.anchorPoint = BMPointMake(event.clientX, event.clientY);
                        break;
                    }
                    else if (window.TouchEvent && window.event instanceof window.TouchEvent) {
                        const touch = window.event.changedTouches[0];
                        popover.anchorPoint = BMPointMake(touch.clientX, touch.clientY);
                        break;
                    }
                }
            case BMPresentationControllerAnchorKind.EventTarget:
                if (window.event && window.event instanceof UIEvent) {
                    popover.anchorNode = (window.event as any)._BMOriginalTarget || window.event.currentTarget as HTMLElement || window.event.target as HTMLElement;
                }
                else if ('target' in window.event) {
                    const target = window.event.target;
                    if (target instanceof HTMLElement) {
                        popover.anchorNode = target;
                    }
                }
                break;
            case BMPresentationControllerAnchorKind.Selector:
                // For selector, find the element according to the selector
                const node = document.querySelector(this.anchor) as DOMNode;
                if (node) {
                    popover.anchorNode = node;
                }
                break;
            case BMPresentationControllerAnchorKind.Widget:
                // For widget, find the widget based on its display name
                const widget = BMFindWidget({named: this.anchor, inMashup: this.mashup});
                if (widget) {
                    popover.anchorNode = widget.boundingBox[0];
                }
                break;
        }

        await this.mashupDefinitionPromise;

        popover.contentView.node.style.borderRadius = '4px';
        popover.contentView.node.style.overflow = 'hidden';

        // If a valid anchor has been identified, bring up the popover
        if (popover.anchorNode || popover.anchorPoint) {
            this.addController(popover);
            popover.delegate = this;
            popover.bringToFrontAnimated(YES);
            this.createMashupForController(popover);
        }
        else {
            // Otherwise cancel this action
            popover.release();
        }
    }

}

@TWWidgetDefinition export class BMWindowController extends BMControllerBase implements BMWindowDelegate {

    // @override - BMWindowDelegate
    windowShouldKeepNodeHidden() {
        return this.modal;
    }

    resizeListener?: (event: Event) => void;

    // @override - BMWindowDelegate
    windowWillClose(popup) {
        super.windowWillClose(popup);

        if (this.modal) {
            window.removeEventListener('resize', this.resizeListener);
        }
    }

    async afterRender() {
        super.afterRender();

    }

    /**
     * Controls whether this window is modal.
     */
    @property modal: boolean;

    /**
     * Controls whether this window can be moved.
     */
    @property movable: boolean;

    /**
     * Controls whether this window can be resized.
     */
    @property resizable: boolean;

    /**
     * Controls whether this window can be resized.
     */
    @property closeButton: boolean;

    /**
     * Controls whether this window can be resized.
     */
    @property fullScreenButton: boolean;

    /**
     * Controls whether multiple windows can be launched by this controller.
     */
    @property multipleWindows: boolean;

	/**
	 * Constructs and returns a toolbar button DOM node. This node will not be added to the document automatically.
	 * @param className <String>			A list of class names that should be assigned to the button.
	 * {
	 * 	@param content <String>				The HTML content that this button should contain.
	 * 	@param action <void ^ (Event)>		An callback function that will be invoked whenever this button is clicked.
	 * 	@param tooltip <String, nullable>	If specified, this represent a tooltip text that appears when hovering over the button.
	 * }
	 * @return <DOMNode>					The button that was created.
	 */
	createToolbarButtonWithClass(className, args: {forWindow: BMWindow, content: string, action: () => void, tooltip?: string}) {
		var button = document.createElement('div');
		button.className = 'BMWindowControllerToolbarButton ' + className;
		button.innerHTML = args.content;
		args.forWindow.toolbar.appendChild(button);
		button.addEventListener('click', args.action);

		if (args.tooltip) {
			button.classList.add('BMHasTooltip');
			button.classList.add('BMTooltipPositionBottom');
			button.setAttribute('data-bm-tooltip', args.tooltip);
		}

		return button;
	}

    @service async bringToFront() {
        // If a window is already open and multiple windows are not supported, cancel this request
        if (this.controllers.length && !this.multipleWindows) return;

        const popup = BMWindowMakeWithFrame(BMRectMakeWithOrigin(BMPointMake(0,0), {size: BMSizeMake(this.controllerWidth || 400, this.controllerHeight || 400)}), {modal: this.modal, toolbar: !this.modal || this.closeButton || this.fullScreenButton});
        popup.frame.center = BMPointMake(window.innerWidth / 2 | 0, window.innerHeight / 2 | 0);
        popup.frame = popup.frame;
        if (this.controllerClass) {
            popup.CSSClass = this.controllerClass;
        }
        if (this.overlayClass && popup.superview) {
            popup.superview.CSSClass = this.overlayClass;
        }

        if (!this.getProperty('matchesSystemColorScheme', YES)) {
            popup.colorScheme = BMViewColorScheme.Light;
        }

        if (this.dismissUsingEscapeKey) {
            this.registerKeyboardShortcutForWindow(popup);
        }

        //const args = {fromNode: undefined, fromRect: undefined};

        switch (this.anchorKind) {
            case BMPresentationControllerAnchorKind.None:
                break;
            case BMPresentationControllerAnchorKind.EventOrigin:
                // For event, only mouse and touch events are supported as other event kinds don't
                // provide appropriate coordinates
                if (window.event) {
                    if (window.event instanceof MouseEvent) {
                        const event = window.event as MouseEvent;
                        popup.anchorRect = BMRectMakeWithOrigin(BMPointMake(event.clientX, event.clientY), {size: BMSizeMake(1, 1)});
                        break;
                    }
                    else if (window.TouchEvent && window.event instanceof window.TouchEvent) {
                        const touch = window.event.changedTouches[0];
                        popup.anchorRect = BMRectMakeWithOrigin(BMPointMake(touch.clientX, touch.clientY), {size: BMSizeMake(1, 1)});
                        break;
                    }
                }
            case BMPresentationControllerAnchorKind.EventTarget:
                if (window.event && window.event instanceof UIEvent) {
                    //@ts-ignore
                    popup.anchorNode = (window.event as any)._BMOriginalTarget || window.event.currentTarget as HTMLElement || window.event.target as HTMLElement;
                }
                break;
            case BMPresentationControllerAnchorKind.Selector:
                // For selector, find the element according to the selector
                const node = document.querySelector(this.anchor) as DOMNode;
                if (node) {
                    //@ts-ignore
                    popup.anchorNode = node;
                }
                break;
            case BMPresentationControllerAnchorKind.Widget:
                // For widget, find the widget based on its display name
                const widget = BMFindWidget({named: this.anchor, inMashup: this.mashup});
                if (widget) {
                    //@ts-ignore
                    popup.anchorNode = widget.boundingBox[0];
                }
                break;
        }

        await this.mashupDefinitionPromise;

        // Add the close/fullscreen buttons if they were selected
        if (this.closeButton) {
            this.createToolbarButtonWithClass('BMWindowControllerCloseButton', {forWindow: popup, content: '<i class="material-icons">&#xE5CD;</i>', action: () => {
                popup.dismissAnimated(YES);
            }});
        }
        else if (this.fullScreenButton) {
            this.createToolbarButtonWithClass('BMWindowControllerCloseButton BMWindowControllerCloseButtonDisabled', {forWindow: popup, content: '<i class="material-icons">&#xE5CD;</i>', action: () => void 0});
        }

        if (this.fullScreenButton) {
            this.createToolbarButtonWithClass('BMWindowControllerFullScreenButton', {forWindow: popup, content: '<i class="material-icons">add</i>', action: () => {
                if (popup.isFullScreen) {
                    popup.exitFullScreenAnimated(YES);
                }
                else {
                    popup.enterFullScreenAnimated(YES);
                }
            }});
        }

        popup.node.classList.add('BMWindowControllerWindow');
        
        this.addController(popup);
        popup.delegate = this;
        popup.bringToFrontAnimated(YES);
        this.createMashupForController(popup);

        if (this.modal) {
            window.addEventListener('resize', this.resizeListener = event => {
                const frame = popup.frame;
                frame.center = BMPointMake(window.innerWidth / 2 | 0, window.innerHeight / 2 | 0);
                popup.frame = frame;
            });
        }

    }
    
    // @override - BMWindowDelegate
    windowShouldMove(window: BMWindow, toPosition: BMPoint) {
        return this.movable;
    }
    
    // @override - BMWindowDelegate
    windowShouldResize(window: BMWindow, toSize: BMSize) {
        return this.resizable;
    }

}

@TWWidgetDefinition export class BMAlertController extends TWRuntimeWidget implements BMWindowDelegate {

    popup?: BMAlertPopup;
    
    @property set title(title: string) {
        if (this.popup) this.popup.title = title;
    }
    
    @property set description(description: string) {
        if (this.popup) this.popup.text = description;
    }
    
    @property set confirmationButtonLabel(label: string) {
        if (this.popup) this.popup.positiveActionText = label;
    }

    /**
     * Shows this controller.
     */
    @service bringToFront() {
        if (this.popup) return;

        this.popup = BMAlertPopup.alertPopupWithTitle(this.title, {text: this.description, actionText: this.confirmationButtonLabel});
        this.popup.delegate = this;
        
        if (this.controllerClass) {
            this.popup.CSSClass = this.controllerClass;
        }
        if (this.overlayClass && this.popup.superview) {
            this.popup.superview.CSSClass = this.overlayClass;
        }

        if (!this.getProperty('matchesSystemColorScheme', YES)) {
            this.popup.colorScheme = BMViewColorScheme.Light;
        }

        this.popup.confirm();
    }

    /**
     * Dismisses this controller.
     */
    @service dismiss() {
        if (this.popup) {
            this.popup.dismissAnimated(YES);
        }
    }

    /**
     * Triggered when this popover closes.
     */
    @event controllerDidClose: TWEvent;

    /**
     * One or more custom classes to add to the controller DOM node.
     */
    @property set controllerClass(cls: string) {
        if (this.popup) {
            this.popup.CSSClass = cls;
        }
    }

    /**
     * One or more CSS classes to add to the controller overlay DOM node.
     */
    @property overlayClass: string;

    // @override - BMWindow
    windowShouldClose(): boolean {
        return NO;
    }

    windowWillClose() {
        this.popup = undefined;
        this.controllerDidClose();
    }

    windowDidClose(window: BMWindow) {
        window.release();
    }

    renderHtml() {
        return '<div class="widget-content"></div>'
    }

    afterRender() {
        this.boundingBox[0].style.display = 'none';
    }

    beforeDestroy() {
        if (this.popup) this.popup.release();
    }

}

@TWWidgetDefinition export class BMConfirmationController extends BMAlertController {

    popup?: BMConfirmationPopup;
    
    @property set confirmationButtonLabel(label: string) {
        if (this.popup) this.popup.positiveActionText = label;
    }

    @property set declineButtonLabel(label: string) {
        if (this.popup) this.popup.negativeActionText = label;
    }

    @property set showsCancelButton(shows: boolean) {
        if (typeof shows === 'string') shows = (shows == 'true') ? true : false;

        if (this.popup) this.popup.showsCancelButton = shows;
    }
    
    @event confirmed: TWEvent;
    
    @event cancelled: TWEvent;
    
    @event declined: TWEvent;

    /**
     * Shows this controller.
     */
    @service bringToFront() {
        if (this.popup) return;

        this.popup = BMConfirmationPopup.confirmationPopupWithTitle(this.title, {text: this.description, positiveActionText: this.confirmationButtonLabel, negativeActionText: this.declineButtonLabel});
        this.popup.showsCancelButton = this.showsCancelButton;
        this.popup.delegate = this;

        if (this.controllerClass) {
            this.popup.CSSClass = this.controllerClass;
        }
        if (this.overlayClass && this.popup.superview) {
            this.popup.superview.CSSClass = this.overlayClass;
        }

        if (!this.getProperty('matchesSystemColorScheme', YES)) {
            this.popup.colorScheme = BMViewColorScheme.Light;
        }

        this.popup.confirm();
    }

    windowWillClose() {
        switch (this.popup?.result) {
            case BMConfirmationPopupResult.Declined:
                this.declined();
                break;
            case BMConfirmationPopupResult.Confirmed:
                this.confirmed();
                break;
            default:
                this.cancelled();
        }

        this.popup = undefined;
        this.controllerDidClose();
    }
}