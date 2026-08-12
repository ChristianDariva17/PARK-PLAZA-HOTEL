using System;

namespace ParkPlaza.Zk9500Bridge
{
    internal sealed class BridgeException : Exception
    {
        public BridgeException(string code, string message, int httpStatus)
            : base(message)
        {
            Code = code;
            HttpStatus = httpStatus;
        }

        public string Code { get; private set; }
        public int HttpStatus { get; private set; }
    }
}
