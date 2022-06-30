var _listeners = [];

EventTarget.prototype.addEventListenerBase = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function(type, listener)
{
    _listeners.push({target: this, type: type, listener: listener});
    this.addEventListenerBase(type, listener);
};

EventTarget.prototype.removeEventListeners = function(targetType)
{
    for(var index = 0; index != _listeners.length; index++)
    {
        var item = _listeners[index];

        var target = item.target;
        var type = item.type;
        var listener = item.listener;

        if(target == this && type == targetType)
        {
            this.removeEventListener(type, listener);
        }
    }
}