////<reference path="../node_modules/bm-core-ui/lib/@types/BMCoreUI.min.d.ts"/>
///<reference path="../../BMCoreUI/build/ui/BMCoreUI/BMCoreUI.d.ts"/>

import { TWWidgetDefinition, autoResizable, description, property, defaultValue, bindingTarget, service, event, bindingSource, nonEditable, willSet, didSet, TWPropertySelectOptions, selectOptions, hidden } from 'typescriptwebpacksupport/widgetidesupport';
import {BMPresentationControllerAnchorKind} from './shared/constants'

const anchorOptions: TWPropertySelectOptions[] = [
    {text: 'Event Origin', value: BMPresentationControllerAnchorKind.EventOrigin},
    {text: 'Event Target', value: BMPresentationControllerAnchorKind.EventTarget},
    {text: 'Selector', value: BMPresentationControllerAnchorKind.Selector},
    {text: 'Widget', value: BMPresentationControllerAnchorKind.Widget},
    {text: 'None', value: BMPresentationControllerAnchorKind.None}
];

interface BMControllerMashupProperty extends TWWidgetProperty {
    _isMashupProperty?: boolean;
    isBaseProperty?: boolean;
    name?: string;
}

@TWWidgetDefinition('Controller Base')
export class BMControllerBase extends TWComposerWidget {
    
    // @override - TWComposerWidget
    widgetProperties() {
        const props = super.widgetProperties();
        (props as any).isVisible = NO;
        return props;
    }
    

    /**
     * The kind of anchor from which this controller will originate.
     */
    @description('The kind of anchor from which this controller will originate.')
    @property('STRING', selectOptions(anchorOptions), defaultValue(BMPresentationControllerAnchorKind.EventOrigin), didSet('anchorKindDidChange')) anchorKind: BMPresentationControllerAnchorKind;

    /**
     * Invoked upon the user selecting a different anchor kind.
     * @param value         The new anchor kind.
     */
    anchorKindDidChange(value: string): boolean {
        switch (value) {
            case BMPresentationControllerAnchorKind.EventOrigin:
            case BMPresentationControllerAnchorKind.EventTarget:
            case BMPresentationControllerAnchorKind.None:
                this.allWidgetProperties().properties.anchor.isVisible = NO;
                this.updateProperties({updateUi: YES});
                break;
            default:
                this.allWidgetProperties().properties.anchor.isVisible = YES;
                this.updateProperties({updateUi: YES});
                break;
        }
        return NO;
    }

    /**
     * The anchor.
     */
    @description('The anchor')
    @property('STRING', bindingTarget, hidden) anchor: string;

    /**
     * The mashup displayed by this controller.
     */
    @description('The mashup displayed by this controller.')
    @property('MASHUPNAME', didSet('mashupDidChange'), bindingTarget) mashupName: string;

    /**
     * The controller's width.
     */
    @description('The controller\'s width. This takes effect the next time this controller\'s window is displayed.')
    @property('NUMBER', bindingTarget, defaultValue(400)) controllerWidth: number;

    /**
     * The controller's height.
     */
    @description('The controller\'s height. This takes effect the next time this controller\'s window is displayed.')
    @property('NUMBER', bindingTarget, defaultValue(400)) controllerHeight: number;

    /**
     * Controls whether this window can be dismissed using the escape key.
     */
    @description('If enabled, the controller can be dismissed using the escape key.')
    @property('BOOLEAN', defaultValue(false)) dismissUsingEscapeKey: boolean;

    /**
     * Controls whether this window can be dismissed by clicking outside, if it is modal.
     */
    @description('If enabled, the controller can be dismissed by clicking outside, if it is modal.')
    @property('BOOLEAN', defaultValue(YES)) dismissUsingOutsideClick: boolean;

    /**
     * Controls whether this controller should match the system color scheme.
     */
    @description('If enabled, the controller will match the system color scheme, otherwise it will always use a light color scheme.')
    @property('BOOLEAN', defaultValue(YES)) matchesSystemColorScheme: boolean;

    /**
     * Invoked upon the user selecting a different mashup.
     * @param value         The new mashup.
     */
    mashupDidChange(value: string): boolean {
        // Load mashup parameters.
        if (value) {
            this.getParametersForMashup(value, {completionHandler: (parameters: any) => {
                // Clear out the current parameters
                const allProperties = this.allWidgetProperties().properties as Dictionary<BMControllerMashupProperty>;
                for (const key of Object.keys(allProperties)) {
                    const property = allProperties[key];
                    if (property._isMashupProperty) {
                        delete allProperties[key];
                    }
                }

                // Add the new parameters
                for (const key of Object.keys(parameters)) {
                    // Skip mashup parameters that duplicate existing properties
                    if (allProperties[key]) continue;

                    allProperties[key] = {
                        name: key,
                        isBaseProperty: NO,
                        type: 'property',
                        baseType: parameters[key].baseType,
                        isBindingTarget: YES,
                        isBindingSource: YES,
                        isVisible: YES,
                        _isMashupProperty: YES
                    }
                }

                this._mashupFields = JSON.stringify(parameters);

                this.updateProperties({updateUi: YES});
            }});
        }
        return NO;
    }

    /**
     * The mashup fields.
     */
    @property('STRING', hidden) _mashupFields: string;

    /**
     * Shows this controller.
     */
    @description('Shows this controller.')
    @service bringToFront;

    /**
     * Dismisses this controller.
     */
    @description('Dismisses this controller.')
    @service dismiss;

    /**
     * Triggered when this popover closes.
     */
    @description('Triggered when this controller closes.')
    @event controllerDidClose;

    /**
     * One or more custom classes to add to the controller DOM node.
     */
    @description('One or more custom classes to add to the controller DOM node.')
    @property('STRING', defaultValue(''), bindingTarget) controllerClass;

    /**
     * One or more custom classes to add to the controller overlay DOM node.
     */
    @description('One or more custom classes to add to the controller overlay DOM node.')
    @property('STRING', defaultValue('')) overlayClass;

    /**
     * The URL to the icon that is displayed in the composer widget.
     */
    largeIcon: string = '';
    
    // @override - TWComposerWidget
    afterLoad() {
        // Reload the mashup fields
        if (this.mashupName) {
            const parameters = JSON.parse(this._mashupFields);

            // Clear out the current parameters
            const allProperties = this.allWidgetProperties().properties as Dictionary<BMControllerMashupProperty>;
            for (const key of Object.keys(allProperties)) {
                const property = allProperties[key];
                if (property._isMashupProperty) {
                    delete allProperties[key];
                }
            }

            // Add the new parameters
            for (const key of Object.keys(parameters)) {
                // Skip mashup parameters that duplicate existing properties
                if (allProperties[key]) continue;

                allProperties[key] = {
                    name: key,
                    isBaseProperty: NO,
                    type: 'property',
                    baseType: parameters[key].baseType,
                    isBindingTarget: YES,
                    isBindingSource: YES,
                    isVisible: YES,
                    _isMashupProperty: YES
                }
            }

            this._mashupFields = JSON.stringify(parameters);

            (this.updatedProperties as any)({updateUi: YES});
            if (this.jqElement) {
                this.updateProperties({updateUi: YES});
            }
        }
    }

    /**
     * Hides the given properties.
     * @param properties    The properties to hide.
     */
    hideProperties(properties: string[]) {
        const allProperties = this.allWidgetProperties().properties as Dictionary<BMControllerMashupProperty>;

        for (const property of properties) {
            allProperties[property].isVisible = NO;
        }
        
        (this.updatedProperties as any)({updateUi: YES});
		if (this.jqElement) {
			this.updateProperties({updateUi: YES});
		}
    }

    /**
     * Shows the given properties.
     * @param properties    The properties to show.
     */
    showProperties(properties: string[]) {
        const allProperties = this.allWidgetProperties().properties as Dictionary<BMControllerMashupProperty>;

        for (const property of properties) {
            allProperties[property].isVisible = YES;
        }
        
        (this.updatedProperties as any)({updateUi: YES});
		if (this.jqElement) {
			this.updateProperties({updateUi: YES});
		}
    }

    // @override - TWComposerWidget
    renderHtml(): string {
        return '<div class="widget-content BMCodeHost">\
            <div class="BMCodeHostContainer">\
                <img src="' + this.largeIcon + '" class="BMControllerBaseIcon" />\
                <div class="InlineBlock BMCHScriptEdit BMCHScriptEditReadonly" >' + this.widgetProperties().name + '</div>\
            </div>\
        </div>';
    }   
    
    // @override - TWComposerWidget
    afterRender(): void {
        
    }
    
    // @override - TWComposerWidget
    widgetIconUrl(): string {
        return require('./images/icon.png').default;
    }

    /**
     * Asynchronously loads the mashup parameter definitions for the given mashup.
     * @param mashup <String>							The mashup for which to get the parameters.
     * {
     *	@param completionHandler <void ^(Object)>		The callback to invoke when the parameters are retrieved.
     *													This callback returns nothing and receives the parameter definitions as its only parameter.
     * }
     */
    getParametersForMashup(mashup: string, args: {completionHandler: (any) => void}) {
        if (!mashup) {
            args.completionHandler({});
            return;
        }
        
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/Thingworx/Mashups/' + mashup + '?Accept=application/json');
        
        xhr.onload = function () {
            if (xhr.status == 200) {
                try {
                    var parameters = JSON.parse(xhr.response).parameterDefinitions;
                    args.completionHandler(parameters);
                }
                catch (error) {
                    args.completionHandler({});
                }
            }
            else {
                args.completionHandler({});
            }
        };
    
        xhr.onerror = () => args.completionHandler({});
        
        xhr.send();
    }
    
    // @override - TWComposerWidget
    beforeDestroy(): void {
        
    }


}

/**
 * A controller that manages the lifecycle of a mashup that is displayed as a popover.
 */
@description('A controller that manages the lifecycle of a mashup that is displayed as a popover.')
@TWWidgetDefinition('Popover Controller')
export class BMPopoverController extends BMControllerBase {

    largeIcon: string = require('./images/PopoverControllerLarge@2x.png').default;

    widgetProperties() {
        const props = super.widgetProperties();
        (props as any).isVisible = YES;
        return props;
    }

    // @override - TWComposerWidget
    @property('NUMBER', defaultValue(160)) Width: number;

    // @override - TWComposerWidget
    @property('NUMBER', defaultValue(48)) Height: number;

    /**
     * Controls the minimum spacing between this popover and the viewport edges.
     */
    @description('Controls the minimum spacing between this popover and the viewport edges.')
    @property('NUMBER', defaultValue(8)) edgeInsets: number;

    /**
     * Controls the directions in which this popover's indicator is allowed to appear.
     */
    @description('Controls the directions in which this popover\'s indicator is allowed to appear.')
    @property('STRING', defaultValue('["Top", "Bottom", "Left", "Right"]')) permittedDirections: string;

    /**
     * Controls how rounded the popover's corners should be.
     */
    @description('Controls how rounded the popover\'s corners should be.')
    @property('NUMBER', defaultValue(4)) borderRadius: number;

    /**
     * Controls the size of the popover indicator
     */
    @description('Controls the size of the popover indicator')
    @property('NUMBER', defaultValue(16)) indicatorSize: number;

    // @override - TWComposerWidget
    widgetIconUrl(): string {
        return require('./images/PopoverController@2x.png').default;
    }
    
    // @override - TWComposerWidget
    renderHtml(): string {
        require('./styles/ide.css');
        return super.renderHtml();
    };

}

/**
 * A controller that manages the lifecycle of a mashup that is displayed as a window.
 */
@description('A controller that manages the lifecycle of a mashup that is displayed as a window.')
@TWWidgetDefinition('Window Controller')
export class BMWindowController extends BMControllerBase {

    largeIcon: string = require('./images/PopupControllerLarge@2x.png').default;

    widgetProperties() {
        const props = super.widgetProperties();
        (props as any).isVisible = YES;
        return props;
    }

    // @override - TWComposerWidget
    @property('NUMBER', defaultValue(160)) Width: number;

    // @override - TWComposerWidget
    @property('NUMBER', defaultValue(48)) Height: number;

    /**
     * Controls whether this window is modal.
     */
    @description('Controls whether this window is modal.')
    @property('BOOLEAN', defaultValue(true), didSet('modalDidChange')) modal: boolean;

    /**
     * Controls whether this window can be moved.
     */
    @description('Controls whether this window can be moved.')
    @property('BOOLEAN', defaultValue(true), hidden) movable: boolean;

    /**
     * Controls whether this window can be resized.
     */
    @description('Controls whether this window can be resized.')
    @property('BOOLEAN', defaultValue(true), hidden) resizable: boolean;

    /**
     * Controls whether this window can be resized.
     */
    @description('If enabled, the window will have a close button.')
    @property('BOOLEAN', defaultValue(true)) closeButton: boolean;

    /**
     * Controls whether this window can be resized.
     */
    @description('If enabled, the window will have a toggle full screen button.')
    @property('BOOLEAN', defaultValue(true)) fullScreenButton: boolean;

    /**
     * If enabled, the controller will be able to create multiple windows.
     */
    @description('If enabled, the controller will be able to create multiple windows.')
    @property('BOOLEAN', defaultValue(true)) multipleWindows: boolean;

    afterLoad() {
        super.afterLoad();

        if (this.modal) {
            this.hideProperties(['movable', 'resizable']);
        }
        else {
            this.showProperties(['movable', 'resizable']);
        }
    }

    modalDidChange(value) {
        if (value) {
            this.hideProperties(['movable', 'resizable']);
        }
        else {
            this.showProperties(['movable', 'resizable']);
        }
    }

    // @override - TWComposerWidget
    widgetIconUrl(): string {
        return require('./images/PopupController@2x.png').default;
    }
    
    // @override - TWComposerWidget
    renderHtml(): string {
        require('./styles/ide.css');
        return super.renderHtml();
    };

}

/**
 * A controller that managed the lifecycle of an alert popup window.
 */
@description('A controller that manages the lifecycle of an alert popup window.')
@TWWidgetDefinition('Alert Controller')
export class BMAlertController extends TWComposerWidget {

    // @override - TWComposerWidget
    @property('NUMBER', defaultValue(160)) Width: number;

    // @override - TWComposerWidget
    @property('NUMBER', defaultValue(48)) Height: number;

    largeIcon: string = require('./images/AlertControllerLarge@2x.png').default;
    
    @description('The controller\'s title.')
    @property('STRING', defaultValue('Alert'), bindingTarget) title;

    @description('A detailed description to display below the title.')
    @property('STRING', defaultValue('An error has occured.'), bindingTarget) description;

    @description('The label to use for the alert\'s confirmation button.')
    @property('STRING', defaultValue('OK'), bindingTarget) confirmationButtonLabel;

    /**
     * Shows this controller.
     */
    @description('Shows this controller.')
    @service bringToFront;

    /**
     * Dismisses this controller.
     */
    @description('Dismisses this controller.')
    @service dismiss;

    /**
     * Triggered when this popover closes.
     */
    @description('Triggered when this controller closes.')
    @event controllerDidClose;

    /**
     * One or more custom classes to add to the controller DOM node.
     */
    @description('One or more custom classes to add to the controller DOM node.')
    @property('STRING', defaultValue(''), bindingTarget) controllerClass;

    /**
     * One or more custom classes to add to the controller overlay DOM node.
     */
    @description('One or more custom classes to add to the controller overlay DOM node.')
    @property('STRING', defaultValue('')) overlayClass;

    
    // @override - TWComposerWidget
    widgetIconUrl(): string {
        return require('./images/AlertController@2x.png').default;
    }
    
    // @override - TWComposerWidget
    renderHtml(): string {
        require('./styles/ide.css');
        return BMControllerBase.prototype.renderHtml.apply(this);
    };

    // @override - TWComposerWidget
    afterRender() {}

    // @override - TWComposerWidget
    beforeDestroy() {}

}



/**
 * A controller that managed the lifecycle of a confirmation popup window.
 */
@description('A controller that manages the lifecycle of a confirmation popup window.')
@TWWidgetDefinition('Confirmation Controller')
export class BMConfirmationController extends BMAlertController {

    // @override - TWComposerWidget
    @property('NUMBER', defaultValue(192)) Width: number;

    largeIcon: string = require('./images/ConfirmationControllerLarge@2x.png').default;

    // @override - TWComposerWidget
    widgetIconUrl(): string {
        return require('./images/ConfirmationController@2x.png').default;
    }

    @description('The label to use for the confirmation\'s decline button.')
    @property('STRING', defaultValue('OK'), bindingTarget) declineButtonLabel;

    @description('Controls whether to display a cancel button, in addition to the confirm and decline buttons.')
    @property('BOOLEAN', defaultValue(NO), bindingTarget) showsCancelButton;
    
    @description('Triggered when the use selects the confirmation button.')
    @event confirmed;
    
    @description('Triggered when the use selects the cancel button.')
    @event cancelled;
    
    @description('Triggered when the use selects the decline button.')
    @event declined;

}