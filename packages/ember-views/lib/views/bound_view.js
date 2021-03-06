/**
@module ember
@submodule ember-views
*/

import { get } from "ember-metal/property_get";
import { set } from "ember-metal/property_set";
import merge from "ember-metal/merge";
import {
  cloneStates,
  states as viewStates
} from "ember-views/views/states";
import _MetamorphView from "ember-views/views/metamorph_view";
import { Mixin } from 'ember-metal/mixin';
import run from 'ember-metal/run_loop';

function K() { return this; }

var states = cloneStates(viewStates);

merge(states._default, {
  rerenderIfNeeded: K
});

merge(states.inDOM, {
  rerenderIfNeeded: function(view) {
    if (view.normalizedValue() !== view._lastNormalizedValue) {
      view.rerender();
    }
  }
});

var NormalizedRerenderIfNeededSupport = Mixin.create({
  _states: states,

  normalizedValue: function() {
    var value = this.lazyValue.value();
    var valueNormalizer = get(this, 'valueNormalizerFunc');
    return valueNormalizer ? valueNormalizer(value) : value;
  },

  rerenderIfNeeded: function() {
    this.currentState.rerenderIfNeeded(this);
  },
});

/**
  `Ember._BoundView` is a private view created by the Handlebars
  `{{bind}}` helpers that is used to keep track of bound properties.

  Every time a property is bound using a `{{mustache}}`, an anonymous subclass
  of `Ember._BoundView` is created with the appropriate sub-template
  and context set up. When the associated property changes, just the template
  for this view will re-render.

  @class _BoundView
  @namespace Ember
  @extends Ember._MetamorphView
  @private
*/
var BoundView = _MetamorphView.extend(NormalizedRerenderIfNeededSupport, {
  instrumentName: 'bound',

  /**
    The function used to determine if the `displayTemplate` or
    `inverseTemplate` should be rendered. This should be a function that takes
    a value and returns a Boolean.

    @property shouldDisplayFunc
    @type Function
    @default null
  */
  shouldDisplayFunc: null,

  /**
    Whether the template rendered by this view gets passed the context object
    of its parent template, or gets passed the value of retrieving `path`
    from the `pathRoot`.

    For example, this is true when using the `{{#if}}` helper, because the
    template inside the helper should look up properties relative to the same
    object as outside the block. This would be `false` when used with `{{#with
    foo}}` because the template should receive the object found by evaluating
    `foo`.

    @property preserveContext
    @type Boolean
    @default false
  */
  preserveContext: false,

  /**
    If `preserveContext` is true, this is the object that will be used
    to render the template.

    @property previousContext
    @type Object
  */
  previousContext: null,

  /**
    The template to render when `shouldDisplayFunc` evaluates to `true`.

    @property displayTemplate
    @type Function
    @default null
  */
  displayTemplate: null,

  /**
    The template to render when `shouldDisplayFunc` evaluates to `false`.

    @property inverseTemplate
    @type Function
    @default null
  */
  inverseTemplate: null,

  lazyValue: null,

  /**
    Determines which template to invoke, sets up the correct state based on
    that logic, then invokes the default `Ember.View` `render` implementation.

    This method will first look up the `path` key on `pathRoot`,
    then pass that value to the `shouldDisplayFunc` function. If that returns
    `true,` the `displayTemplate` function will be rendered to DOM. Otherwise,
    `inverseTemplate`, if specified, will be rendered.

    For example, if this `Ember._BoundView` represented the `{{#with
    foo}}` helper, it would look up the `foo` property of its context, and
    `shouldDisplayFunc` would always return true. The object found by looking
    up `foo` would be passed to `displayTemplate`.

    @method render
    @param {Ember.RenderBuffer} buffer
  */
  render: function(buffer) {
    var shouldDisplay = get(this, 'shouldDisplayFunc');
    var preserveContext = get(this, 'preserveContext');
    var context = get(this, 'previousContext');

    var inverseTemplate = get(this, 'inverseTemplate');
    var displayTemplate = get(this, 'displayTemplate');

    var result = this.normalizedValue();

    this._lastNormalizedValue = result;

    // First, test the conditional to see if we should
    // render the template or not.
    if (shouldDisplay(result)) {
      set(this, 'template', displayTemplate);

      // If we are preserving the context (for example, if this
      // is an #if block, call the template with the same object.
      if (preserveContext) {
        set(this, '_context', context);
      } else {
      // Otherwise, determine if this is a block bind or not.
      // If so, pass the specified object to the template
        if (displayTemplate) {
          set(this, '_context', result);
        } else {
        // This is not a bind block, just push the result of the
        // expression to the render context and return.
          if (result === null || result === undefined) {
            result = "";
          }

          buffer.push(result);
          return;
        }
      }
    } else if (inverseTemplate) {
      set(this, 'template', inverseTemplate);

      if (preserveContext) {
        set(this, '_context', context);
      } else {
        set(this, '_context', result);
      }
    } else {
      set(this, 'template', function() { return ''; });
    }

    return this._super(buffer);
  }
});


var BoundIfView = _MetamorphView.extend(NormalizedRerenderIfNeededSupport, {
  init: function() {
    this._super();

    var self = this;

    this.conditionStream.subscribe(this._wrapAsScheduled(function() {
      run.scheduleOnce('render', self, 'rerenderIfNeeded');
    }));
  },

  normalizedValue: function() {
    return this.conditionStream.value();
  },

  render: function(buffer) {
    var result = this.conditionStream.value();
    this._lastNormalizedValue = result;

    if (result) {
      set(this, 'template', this.truthyTemplate);
    } else {
      set(this, 'template', this.falsyTemplate);
    }

    return this._super(buffer);
  }
});

export default BoundView;
export { BoundIfView };
