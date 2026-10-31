import ActivityKit
import SwiftUI
import WidgetKit

private enum Palette {
  static let ground = Color(red: 14/255, green: 21/255, blue: 18/255)
  static let surface = Color(red: 26/255, green: 35/255, blue: 32/255)
  static let line = Color(red: 36/255, green: 48/255, blue: 44/255)
  static let lime = Color(red: 201/255, green: 242/255, blue: 77/255)
  static let mint = Color(red: 126/255, green: 224/255, blue: 192/255)
  static let text = Color(red: 242/255, green: 245/255, blue: 244/255)
  static let muted = Color(red: 151/255, green: 165/255, blue: 160/255)
}
private struct Mark: View {
  var body: some View { Image("TaptimeMark").resizable().scaledToFit().accessibilityHidden(true) }
}
private struct DurationView: View {
  let state: TapTimeActivityAttributes.ContentState
  var compact = false
  var body: some View {
    if LockLogic.showsDuration(state.state, state.display) {
      VStack(alignment: .trailing, spacing: 0) {
        Group {
          if state.display == .OFFLINE, let at = LockLogic.date(state.state.breakStartedAt ?? state.state.startedAt) {
            Text(timerInterval: at...Date.distantFuture, countsDown: false, showsHours: true).monospacedDigit().multilineTextAlignment(.trailing)
          } else if state.state.status == "running", let at = LockLogic.date(state.state.asOf) {
            // SwiftUI's system timer keeps running while the app and extension are suspended.
            Text(timerInterval: at.addingTimeInterval(-Double(state.state.workDurationSeconds))...Date.distantFuture,
              countsDown: false, showsHours: true).monospacedDigit().multilineTextAlignment(.trailing)
          } else { Text(LockLogic.duration(state.state.workDurationSeconds)) }
        }.font(.custom(compact ? "Manrope-SemiBold" : "Manrope-ExtraBold", fixedSize: compact ? 15 : 28))
          .foregroundStyle(state.state.status == "paused" ? Palette.text : Palette.lime)
          .lineLimit(1).minimumScaleFactor(0.6)
        if state.display == .OFFLINE, !compact {
          Text(state.state.status == "paused" ? "seit Pausenbeginn" : "seit Beginn").font(.custom("Manrope-Regular", fixedSize: 10)).foregroundStyle(Palette.muted)
        } else if state.state.status == "paused", !compact {
          Text("gearbeitet").font(.custom("Manrope-Regular", fixedSize: 10)).foregroundStyle(Palette.muted)
            .lineLimit(1)
        }
      }
    }
  }
}
private struct ActionsView: View {
  let context: ActivityViewContext<TapTimeActivityAttributes>
  var body: some View {
    if #available(iOS 17.0, *), !context.isStale {
      HStack(spacing: 8) {
        ForEach(LockLogic.actions(context.state.state, context.state.display), id: \.self) { action in
          if context.state.canSend || (action == "retry" && context.state.expiresAt != nil) {
            Button(intent: LockScreenActionIntent(action: action, nonce: context.state.nonce)) { label(action) }.buttonStyle(.plain)
          } else if let url = URL(string: context.attributes.captureURL) {
            Link(destination: url) { label(action) }
          }
        }
      }
    }
  }
  private func label(_ action: String) -> some View {
    Text(LockLogic.label(action)).font(.custom("Manrope-SemiBold", fixedSize: 14)).lineLimit(1).minimumScaleFactor(0.75)
      .frame(maxWidth: .infinity).frame(height: 44)
      .foregroundStyle(action == "stop" ? Palette.ground : Palette.text)
      .background(action == "stop" ? Palette.lime : Palette.surface, in: RoundedRectangle(cornerRadius: 12))
      .overlay(RoundedRectangle(cornerRadius: 12).stroke(action == "stop" ? Palette.lime : Palette.line, lineWidth: 1))
  }
}
struct TapTimeLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TapTimeActivityAttributes.self) { context in
      VStack(alignment: .leading, spacing: 10) {
        HStack(spacing: 10) {
          Mark().frame(width: 32, height: 32)
          VStack(alignment: .leading, spacing: 2) {
            Text(LockLogic.title(context.state.state, context.state.display))
              .font(.custom("Manrope-ExtraBold", fixedSize: 17)).foregroundStyle(Palette.text).lineLimit(1)
            Text(context.isStale ? "Bitte App öffnen" : LockLogic.subtitle(context.state.state, context.state.display))
              .font(.custom("Manrope-Regular", fixedSize: 12))
              .foregroundStyle(context.state.state.status == "paused" ? Palette.mint : Palette.muted).lineLimit(1)
          }.frame(maxWidth: .infinity, alignment: .leading)
          if LockLogic.showsDuration(context.state.state, context.state.display), !context.isStale {
            DurationView(state: context.state).frame(width: 118, alignment: .trailing)
          }
        }.frame(height: 54)
        ActionsView(context: context)
      // 28 padding + 54 header + 10 spacing + 44 buttons = 136 pt, below 150 pt.
      }.padding(14).activityBackgroundTint(Palette.ground).activitySystemActionForegroundColor(Palette.mint)
        .widgetURL(URL(string: context.attributes.captureURL))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) { Mark().frame(width: 30, height: 30) }
        DynamicIslandExpandedRegion(.trailing) {
          if !context.isStale { DurationView(state: context.state, compact: true).frame(maxWidth: 110) }
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 8) {
            Text(LockLogic.title(context.state.state, context.state.display)).font(.custom("Manrope-ExtraBold", fixedSize: 17)).foregroundStyle(Palette.text).lineLimit(1)
            Text(context.isStale ? "Bitte App öffnen" : LockLogic.subtitle(context.state.state, context.state.display))
              .font(.custom("Manrope-Regular", fixedSize: 13)).foregroundStyle(Palette.mint).lineLimit(1)
            ActionsView(context: context)
          }
        }
      } compactLeading: { Mark().frame(width: 24, height: 24) }
        compactTrailing: { if !context.isStale { DurationView(state: context.state, compact: true).frame(width: 74) } }
        minimal: { Mark().frame(width: 24, height: 24) }
        .widgetURL(URL(string: context.attributes.captureURL)).keylineTint(Palette.mint)
    }
  }
}
@main struct TapTimeWidgetBundle: WidgetBundle { var body: some Widget { TapTimeLiveActivity() } }
