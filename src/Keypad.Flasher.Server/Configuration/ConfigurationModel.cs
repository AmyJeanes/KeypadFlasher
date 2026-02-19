using System;
using System.Linq;
using System.Text.Json.Serialization;

namespace Keypad.Flasher.Server.Configuration
{
    public enum HidBindingType
    {
        Sequence
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum HidStepKind
    {
        Key,
        Pause,
        Function,
        Mouse
    }

    public enum HidPointerType : byte
    {
        MoveUp = 0,
        MoveDown = 1,
        MoveLeft = 2,
        MoveRight = 3,
        LeftClick = 4,
        RightClick = 5,
        ScrollUp = 6,
        ScrollDown = 7
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum PassiveLedMode
    {
        Off,
        Rainbow,
        Static,
        Breathing
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ActiveLedMode
    {
        Off,
        Solid,
        Nothing
    }

    public sealed record HidStep(
        HidStepKind Kind,
        byte Keycode,
        byte Modifiers,
        byte HoldMs,
        byte GapMs,
        byte FunctionValue,
        HidPointerType PointerType,
        byte PointerValue,
        string? FunctionPointer = null)
    {
        public static HidStep Key(byte keycode, byte modifiers = 0, byte holdMs = 10, byte gapMs = 10)
            => new(HidStepKind.Key, keycode, modifiers, holdMs, gapMs, 1, 0, 0, null);

        public static HidStep Pause(byte gapMs)
            => new(HidStepKind.Pause, 0, 0, 0, gapMs, 1, 0, 0, null);

        public static HidStep Function(string functionPointer, byte gapMs = 0, byte functionValue = 1)
            => new(HidStepKind.Function, 0, 0, 0, gapMs, functionValue, 0, 0, functionPointer);

        public static HidStep Mouse(HidPointerType pointerType, byte pointerValue, byte gapMs = 0)
            => new(HidStepKind.Mouse, 0, 0, 0, gapMs, 1, pointerType, pointerValue, null);
    }

    [JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
    [JsonDerivedType(typeof(HidSequenceBinding), "Sequence")]
    public abstract record HidBinding([property: JsonIgnore] HidBindingType Type);

    public sealed record HidSequenceBinding : HidBinding
    {
        [JsonConstructor]
        public HidSequenceBinding(IReadOnlyList<HidStep> steps)
            : base(HidBindingType.Sequence)
        {
            Steps = steps ?? Array.Empty<HidStep>();
        }

        public IReadOnlyList<HidStep> Steps { get; init; }

        public HidSequenceBinding(string sequence, byte modifiers = 0)
            : this(sequence.Select(ch => HidStep.Key((byte)ch, modifiers)).ToList())
        {
        }

        public static HidSequenceBinding FromFunction(string functionPointer, byte gapMs = 0)
            => new(new[] { HidStep.Function(functionPointer, gapMs) });
    }

    public sealed record ButtonBinding(
        int Pin,
        bool ActiveLow,
        int LedIndex,
        bool BootloaderOnBoot,
        bool BootloaderChordMember,
        HidBinding Function);

    public sealed record ButtonBindingEntry(int Id, HidBinding Binding);

    public sealed record EncoderBinding(
        int PinA,
        int PinB,
        HidBinding Clockwise,
        HidBinding CounterClockwise);

    public sealed record EncoderBindingEntry(
        int Id,
        HidBinding Clockwise,
        HidBinding CounterClockwise,
        HidBinding? Press);

    public sealed record LedColor(byte R, byte G, byte B);

    public sealed record LedTiming(
        byte RainbowStepMs = 20,
        byte BreathingMinPercent = 20,
        byte BreathingStepMs = 20);

    public sealed record LedPerKey(
        PassiveLedMode PassiveMode,
        LedColor PassiveColor,
        ActiveLedMode ActiveMode,
        LedColor ActiveColor,
        LedTiming? Timing = null,
        byte? RainbowStepMs = null,
        byte? BreathingMinPercent = null,
        byte? BreathingStepMs = null);

    public sealed record LedConfiguration(
        IReadOnlyList<LedPerKey> Leds,
        byte BrightnessPercent = 100);

    public sealed record DebugOptions(
        bool EnableNoiseFilter = true,
        bool EnablePullups = true,
        byte ConfirmSamples = 3,
        byte ConfirmDelayMs = 1)
    {
        public static readonly DebugOptions Default = new();
    }

    public sealed record ConfigurationDefinition(
        IReadOnlyList<ButtonBinding> Buttons,
        IReadOnlyList<EncoderBinding> Encoders,
        bool DebugMode,
        int NeoPixelPin,
        bool NeoPixelReversed,
        LedConfiguration LedConfig,
        DebugOptions DebugOptions);

    // Hardware-only shape; no bindings attached so UI can present physical controls separately from actions
    public abstract record InputLayout(
        int Pin,
        bool ActiveLow,
        bool BootloaderOnBoot,
        bool BootloaderChordMember);

    public sealed record ButtonLayout(
        int Id,
        int Pin,
        bool ActiveLow,
        int LedIndex,
        bool BootloaderOnBoot,
        bool BootloaderChordMember) : InputLayout(Pin, ActiveLow, BootloaderOnBoot, BootloaderChordMember);

    public sealed record EncoderPressLayout(
        int Pin,
        bool ActiveLow,
        bool BootloaderOnBoot,
        bool BootloaderChordMember) : InputLayout(Pin, ActiveLow, BootloaderOnBoot, BootloaderChordMember);

    public sealed record EncoderLayout(
        int Id,
        int PinA,
        int PinB,
        EncoderPressLayout? Press);

    public sealed record DeviceLayout(
        IReadOnlyList<ButtonLayout> Buttons,
        IReadOnlyList<EncoderLayout> Encoders,
        int NeoPixelPin,
        bool NeoPixelReversed);

    public sealed record BindingProfile(
        IReadOnlyList<ButtonBindingEntry> Buttons,
        IReadOnlyList<EncoderBindingEntry> Encoders);
}
