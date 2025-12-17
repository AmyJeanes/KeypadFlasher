namespace Keypad.Flasher.Server.Configuration
{
    public enum HidBindingType
    {
        Sequence,
        Function
    }

    public abstract record HidBinding(HidBindingType Type);

    public sealed record HidSequenceBinding(string Sequence, byte Delay)
        : HidBinding(HidBindingType.Sequence);

    public sealed record HidFunctionBinding(string FunctionPointer)
        : HidBinding(HidBindingType.Function);

    public sealed record ButtonBinding(
        int Pin,
        bool ActiveLow,
        int LedIndex,
        bool BootloaderOnBoot,
        bool BootloaderChordMember,
        HidBinding Function);

    public sealed record EncoderBinding(
        int PinA,
        int PinB,
        HidBinding Clockwise,
        HidBinding CounterClockwise);

    public sealed record ConfigurationDefinition(
        IReadOnlyList<ButtonBinding> Buttons,
        IReadOnlyList<EncoderBinding> Encoders,
        bool DebugMode,
        int NeoPixelPin);
}
