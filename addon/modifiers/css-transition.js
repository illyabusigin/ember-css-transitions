import Modifier from 'ember-modifier';
import { dasherize } from '@ember/string';

import { nextTick, sleep, computeTimeout } from 'ember-css-transitions/utils/transition-utils';

/**
  Modifier that applies classes. Usage:

  ```hbs
  <div {{css-transition "example"}}>
    <p>Hello world</p>
  </div>
  ```

  @class CssTransitionModifier
  @argument didTransitionIn
  @argument didTransitionOut
  @public
*/
export default class CssTransitionModifier extends Modifier {

  clone = null;
  parentElement = null;
  nextElementSibling = null;
  
  get el() {
    return this.clone || this.element;
  }

  get enterEnabled() {
    if (this.args.named.enter && this.args.named.enterActive) {
      return true;
    }

    return false;
  }

  get leaveEnabled() {
    if (this.args.named.leave && this.args.named.leaveActive) {
      return true;
    }

    return false;
  }

  async didInstall() {
    if (!this.enterEnabled) {
      return;
    }

    let transitionClass = this.args.named.enter.split(' ');

    if (transitionClass) {
      let animationType = 'enter';
      this.addClass(transitionClass);

      await nextTick();
      await this.transition(animationType, transitionClass);

      if (this.args.named.didTransitionIn) {
        this.args.named.didTransitionIn();
      }
    }

    this.parentElement = this.element.parentElement;
    this.nextElementSibling = this.element.nextElementSibling;
  }

  async willRemove() {
    if (!this.leaveEnabled) {
      return;
    }

    let transitionClass = this.args.named.leave.split(' ');

    if (transitionClass) {
      let animationType = 'leave';

      // We can't stop ember from removing the element
      // so we clone the element to animate it out
      this.addClone();
      await nextTick();

      await this.transition(animationType, transitionClass);

      this.removeClone();

      if (this.args.named.didTransitionOut) {
        this.args.named.didTransitionOut();
      }

      this.clone = null;
    }
  }

  prev = {};

  ignoredArgs = [
    'didTransitionIn',
    'didTransitionOut',
    'enter',
    'enterActive',
    'leave',
    'leaveActive',
  ];

  get validArgs() {
    return Object.keys(this.args.named).filter(
      (i) => !this.ignoredArgs.includes(i)
    );
  }

  async didUpdateArguments() {
    for (let key of this.validArgs) {
      let prevValue = this.prev[key];
      let value = this.args.named[key];
      this.prev[key] = value; // update previous value

      if (prevValue !== value) {
        let className = dasherize(key);

        if (value) {
          this.addClass(className);
          await this.transition('add', className);

          if (this.args.named.didTransitionIn) {
            this.args.named.didTransitionIn(className);
          }
        } else {
          await this.transition('remove', className);

          if (this.args.named.didTransitionOut) {
            this.args.named.didTransitionOut(className);
          }
        }
      }
    }
  }

  addClone() {
    let original = this.element;
    let parentElement = original.parentElement || this.parentElement;
    let nextElementSibling =
      original.nextElementSibling || this.nextElementSibling;
    let clone = original.cloneNode(true);

    clone.setAttribute('id', `${original.id}_clone`);

    parentElement.insertBefore(clone, nextElementSibling);

    this.clone = clone;
  }

  removeClone() {
    if (this.clone.isConnected && this.clone.parentNode !== null) {
      this.clone.parentNode.removeChild(this.clone);
    }
  }

  /**
   * Transitions the element.
   *
   * @private
   * @method transition
   * @param {String} animationType The animation type, e.g. "enter" or "leave".
   * @param {String} transitionClass The name of the class with the transition defined
   * @return {Promise}
   */
  async transition(animationType, transitionClass) {
    let element = this.el;

    let className = transitionClass;
    let activeClassName = (function (self) {
      if (animationType == 'enter') {
        return self.args.named.enterActive.split(' ');
      }

      return self.args.named.leaveActive.split(' ');
    })(this);

    // add first class right away
    this.addClass(className);

    await nextTick();

    // This is for to force a repaint,
    // which is necessary in order to transition styles when adding a class name.
    element.scrollTop;
    // add active class after repaint
    this.addClass(activeClassName);

    // if we're animating a class removal
    // we need to remove the class
    if (animationType === 'remove') {
      this.removeClass(transitionClass);
    }

    // wait for ember to apply classes
    // set timeout for animation end
    await sleep(computeTimeout(element) || 0);

    this.removeClass(className);
    this.removeClass(activeClassName);
  }

  addClass(classNames) {
    for (let c of classNames) {
      this.el.classList.add(c);
    }
  }

  removeClass(classNames) {
    for (let c of classNames) {
      this.el.classList.remove(c);
    }
  }
}
